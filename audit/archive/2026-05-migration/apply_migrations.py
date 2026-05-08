#!/usr/bin/env python3
"""LessonLoop migration applier — Management API path.

Usage:
  apply.py bootstrap
  apply.py count
  apply.py batch <start> <end>     # 1-based inclusive
"""
import sys, os, re, json, subprocess, time, pathlib

MIGRATIONS_DIR = pathlib.Path('/home/user/lessonloop3/supabase/migrations')
TMP_DIR = pathlib.Path('/tmp/lessonloop-migration-tmp')
WORKDIR = '/home/user/lessonloop3'

# Migrations whose DDL must NOT execute. We INSERT a schema_migrations row only.
# Identified by version (the 14-char timestamp prefix).
RECORD_ONLY_VERSIONS = {
    '20260223100000',  # calsync_cron_guardian_health.sql — nested $$ + 178 redoes the column adds
    '20260225010707',  # cf3a1354-… — redundant; same content as 194+195 combined
    '20260425093622',  # f0390152-… — nested $$ + 20260429000 redoes the function
    '20260429080417',  # 12d4e631-… — DML-only spotcheck with hardcoded source UUIDs; depends on source data
    '20260429100100',  # schedule_auto_pay_final_reminder.sql — nested $$, cron-only payload
    '20260502060816',  # a9efa577-… — DML-only CW-F4 trigger sanity test against hardcoded source invoice
    '20260516100000',  # canary_walk_batch_1z_combined_fixes.sql — broken triggers (transition tables 0A000)
}

# Postgres error codes that trigger auto-record-only (treat as "object already exists, schema convergent")
AUTO_SKIP_CODES = {
    '42710',  # duplicate_object (type, function, etc.)
    '42P07',  # duplicate_table
    '42P06',  # duplicate_schema
    '42701',  # duplicate_column
    '42723',  # duplicate_function (specific)
    '42P16',  # invalid_table_definition (some duplicate-type forms)
    '42712',  # duplicate_alias
}

# Audit log file for auto-skip events
AUTO_SKIP_LOG_PATH = pathlib.Path('/tmp/lessonloop-migration-tmp/auto-skip-log.json')

# Detects BEGIN/COMMIT/ROLLBACK at line start (with optional whitespace),
# followed by ; — line-anchored to avoid matching mid-line tokens.
TX_PATTERN = re.compile(r'(?im)^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\s*;')
NAME_PATTERN = re.compile(r'^(\d{14})_(.+)\.sql$')

# For nested-$$ cron transform detection
CRON_RE = re.compile(r'cron\.schedule\s*\(')
DOLLAR_OPEN_RE = re.compile(r'\$([a-zA-Z_][a-zA-Z0-9_]*)?\$')
BARE_DOLLAR_RE = re.compile(r'\$\$')

TRANSFORM_LOG = []  # accumulates per-batch transform records
AUTO_SKIP_LOG = []  # accumulates auto-record-only events (persisted to disk per batch)


# Regex to extract Postgres error code + message from CLI's stderr blob
PG_ERROR_RE = re.compile(r'ERROR:\s+(\w{5}):\s+(.+?)(?:\\n|"\}|\n|$)', re.DOTALL)
# Inside the message, an object name in double-quotes
QUOTED_NAME_RE = re.compile(r'"([^"]+)"')
# First CREATE statement in a migration file (TYPE/TABLE/FUNCTION/INDEX/SCHEMA/VIEW)
FIRST_CREATE_RE = re.compile(
    r'(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(TYPE|TABLE|FUNCTION|INDEX|SCHEMA|VIEW|MATERIALIZED\s+VIEW)\s+'
    r'(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.|extensions\.)?([A-Za-z_][A-Za-z0-9_]*)'
)


def parse_pg_error(stderr_text):
    """Return (sqlstate, message) extracted from the CLI's stderr blob, or (None, None) if not parseable."""
    m = PG_ERROR_RE.search(stderr_text)
    if not m:
        return None, None
    return m.group(1), m.group(2).replace('\\"', '"').strip()


def extract_object_name(error_msg):
    """Return the first double-quoted name in a Postgres error message, or None."""
    m = QUOTED_NAME_RE.search(error_msg or '')
    return m.group(1) if m else None


def verify_clean_rollback(content, colliding_obj, was_wrapped_by_us):
    """Verify transaction rollback semantics.

    When the script wraps the file in BEGIN/COMMIT (was_wrapped_by_us=True),
    Postgres atomicity guarantees no partial-apply on error.

    When the file controls its own transaction(s), partial-apply is possible
    only if the file has MULTIPLE BEGIN statements — a successful first
    BEGIN/COMMIT pair can persist before a later one fails.
    """
    if was_wrapped_by_us:
        return True, "BEGIN/COMMIT wrapped by script — atomicity guaranteed"
    tx_count = len(re.findall(r'(?im)^\s*BEGIN\s*;', content))
    if tx_count <= 1:
        return True, f"file has {tx_count} BEGIN — single transaction, atomicity assumed"
    return False, (f"file has {tx_count} BEGIN statements; an earlier transaction may have committed "
                   "before the failing one. Halting for manual review.")


def append_auto_skip_log(entry):
    AUTO_SKIP_LOG.append(entry)
    AUTO_SKIP_LOG_PATH.parent.mkdir(exist_ok=True, parents=True)
    AUTO_SKIP_LOG_PATH.write_text(json.dumps(AUTO_SKIP_LOG, indent=2))


def is_in_line_comment(content, pos):
    line_start = content.rfind('\n', 0, pos) + 1
    return '--' in content[line_start:pos]


def find_real_cron_calls(content):
    return [m for m in CRON_RE.finditer(content) if not is_in_line_comment(content, m.start())]


def transform_for_apply(content, filename):
    """Return (sql_to_execute, transform_info_or_None).

    Conditions:
      (a) file contains DO $$ block
      (b) file's cron.schedule( body opens with bare $$
      (c) file does not contain $cron$ literal

    All true → in-memory replace each pair of bare $$ surrounding a cron body with $cron$.
    (a)+(b) but not (c) → raise ValueError (UNSAFE).
    Otherwise → no transform.
    """
    has_do = bool(re.search(r'(?m)^\s*DO\s+\$\$', content))
    has_cron_tag = '$cron$' in content
    real_calls = find_real_cron_calls(content)
    if not real_calls:
        return content, None

    bare_pairs = []
    for cm in real_calls:
        tag_match = DOLLAR_OPEN_RE.search(content, pos=cm.end())
        if not tag_match:
            continue
        tag = tag_match.group(1) or ''
        if tag == '':
            close = BARE_DOLLAR_RE.search(content, pos=tag_match.end())
            if not close:
                continue
            body = content[tag_match.end():close.start()]
            if '$$' in body:
                continue
            bare_pairs.append({'open': (tag_match.start(), tag_match.end()),
                               'close': (close.start(), close.end())})

    if not bare_pairs:
        return content, None

    if not has_do:
        # NO-DO-BLOCK: structurally fine, no transform
        return content, None

    if has_cron_tag:
        raise ValueError(
            f"{filename}: matches (a)+(b) (DO $$ + bare $$ cron body) but file contains "
            f"$cron$ literal already — refusing to transform (would conflict)"
        )

    # Apply substitutions in reverse order to preserve byte positions
    new_content = content
    for pair in reversed(bare_pairs):
        cs, ce = pair['close']
        os, oe = pair['open']
        new_content = new_content[:cs] + '$cron$' + new_content[ce:]
        new_content = new_content[:os] + '$cron$' + new_content[oe:]

    info = {
        'file': filename,
        'pairs': len(bare_pairs),
        'substitutions': len(bare_pairs) * 2,
        'bytes_before': len(content),
        'bytes_after': len(new_content),
        'positions': [(p['open'], p['close']) for p in bare_pairs],
    }
    return new_content, info


def run_supabase_query(sql_text=None, sql_file=None, timeout=120):
    cmd = ['supabase', 'db', 'query', '--linked', '--output', 'json']
    if sql_file:
        cmd += ['--file', str(sql_file)]
    else:
        cmd.append(sql_text)
    return subprocess.run(cmd, capture_output=True, text=True, cwd=WORKDIR, timeout=timeout)


def parse_filename(filename):
    m = NAME_PATTERN.match(filename)
    if not m:
        raise ValueError(f"unexpected filename: {filename}")
    return m.group(1), m.group(2)


def strip_sql_comments(content):
    """Remove SQL block (/* … */) and line (-- …) comments. Used by CONCURRENTLY detection."""
    # Block comments — non-greedy, multi-line
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    # Line comments — to end of line
    content = re.sub(r'--[^\n]*', '', content)
    return content


def has_tx_statements(content):
    return bool(TX_PATTERN.search(content))


def needs_no_wrap(content):
    """True if the migration contains CONCURRENTLY in actual DDL (outside comments)."""
    return bool(re.search(r'\bCONCURRENTLY\b', strip_sql_comments(content), re.IGNORECASE))


def split_sql_statements(content):
    """Split SQL content into individual statements, respecting single-quoted strings
    and dollar-quoted strings (named or unnamed). Strips block and line comments first."""
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'--[^\n]*', '', content)

    statements = []
    current = []
    i = 0
    in_squote = False
    in_dquote = None  # holds the active tag like '$cron$' or '$$', or None
    n = len(content)
    while i < n:
        c = content[i]
        if in_squote:
            if c == "'":
                if i + 1 < n and content[i + 1] == "'":
                    current.append("''")
                    i += 2
                    continue
                in_squote = False
            current.append(c)
            i += 1
        elif in_dquote:
            if content[i:i + len(in_dquote)] == in_dquote:
                current.append(in_dquote)
                i += len(in_dquote)
                in_dquote = None
            else:
                current.append(c)
                i += 1
        elif c == "'":
            in_squote = True
            current.append(c)
            i += 1
        elif c == '$':
            m = re.match(r'\$([a-zA-Z_][a-zA-Z0-9_]*)?\$', content[i:])
            if m:
                tag = m.group(0)
                in_dquote = tag
                current.append(tag)
                i += len(tag)
            else:
                current.append(c)
                i += 1
        elif c == ';':
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
        else:
            current.append(c)
            i += 1
    final = ''.join(current).strip()
    if final:
        statements.append(final)
    return statements


def find_concurrently_lines(content):
    """Return list of (line_number, line_text) where CONCURRENTLY appears outside comments."""
    matches = []
    in_block = False
    for i, line in enumerate(content.split('\n'), 1):
        s = line
        if in_block:
            if '*/' in s:
                s = s.split('*/', 1)[1]
                in_block = False
            else:
                continue
        # Handle block-comment opens on this line
        while '/*' in s:
            before, _, after = s.partition('/*')
            if '*/' in after:
                _, _, after2 = after.partition('*/')
                s = before + after2
            else:
                s = before
                in_block = True
                break
        # Strip line comment
        if '--' in s:
            s = s.split('--')[0]
        if re.search(r'\bCONCURRENTLY\b', s, re.IGNORECASE):
            matches.append((i, line.rstrip()))
    return matches


def parse_json_output(stdout):
    """The CLI may prefix stdout with status lines on stderr; stdout itself should be clean JSON."""
    s = stdout.strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        # try line-by-line for first JSON object
        for line in s.splitlines():
            line = line.strip()
            if line.startswith('{'):
                try:
                    return json.loads(line)
                except json.JSONDecodeError:
                    continue
        return None


def format_error(filename, version, tmp_file, result):
    parts = [f"  file:    {filename}", f"  version: {version}"]
    if tmp_file:
        parts.append(f"  tmp:     {tmp_file}")
    parts.append(f"  rc:      {result.returncode}")
    if result.stderr.strip():
        parts.append("  --- stderr ---")
        for line in result.stderr.strip().splitlines():
            parts.append(f"    {line}")
    if result.stdout.strip():
        parts.append("  --- stdout ---")
        j = parse_json_output(result.stdout)
        if j is not None:
            parts.append("    " + json.dumps(j, indent=2).replace("\n", "\n    "))
        else:
            for line in result.stdout.strip().splitlines():
                parts.append(f"    {line}")
    return "\n".join(parts)


def get_migration_count():
    r = run_supabase_query(sql_text="SELECT count(*)::int AS c FROM supabase_migrations.schema_migrations;")
    if r.returncode != 0:
        return None, r.stderr or r.stdout
    j = parse_json_output(r.stdout)
    if not j or 'rows' not in j or not j['rows']:
        return None, f"unexpected response: {r.stdout[:500]}"
    return j['rows'][0]['c'], None


def get_dupe_breakdown():
    """Return (total_rows, distinct_versions, num_dup_groups, extra_rows) or (None, error)."""
    r = run_supabase_query(sql_text="""
SELECT
  (SELECT count(*)::int FROM supabase_migrations.schema_migrations) AS total_rows,
  (SELECT count(DISTINCT version)::int FROM supabase_migrations.schema_migrations) AS distinct_versions,
  (SELECT count(*)::int FROM (SELECT version FROM supabase_migrations.schema_migrations GROUP BY version HAVING count(*) > 1) g) AS dup_groups
""")
    if r.returncode != 0:
        return None, r.stderr or r.stdout
    j = parse_json_output(r.stdout)
    if not j or 'rows' not in j or not j['rows']:
        return None, f"unexpected response: {r.stdout[:500]}"
    row = j['rows'][0]
    extra = row['total_rows'] - row['distinct_versions']
    return (row['total_rows'], row['distinct_versions'], row['dup_groups'], extra), None


def build_insert_sql(version, name, content):
    """INSERT into schema_migrations using single-quote escaping (standard_conforming_strings = on)."""
    name_esc = name.replace("'", "''")
    content_esc = content.replace("'", "''")
    return (
        f"INSERT INTO supabase_migrations.schema_migrations (version, name, statements) "
        f"VALUES ('{version}', '{name_esc}', ARRAY['{content_esc}']::text[]);"
    )


def apply_one(path, idx, total, quiet=False):
    filename = path.name
    version, name = parse_filename(filename)
    content = path.read_text()  # ORIGINAL — used for schema_migrations INSERT (audit trail)

    # RECORD-ONLY policy fires FIRST — these never execute DDL, never get transformed.
    is_record_only = version in RECORD_ONLY_VERSIONS

    sql_for_execute = content
    transform_info = None
    if not is_record_only:
        try:
            sql_for_execute, transform_info = transform_for_apply(content, filename)
        except ValueError as e:
            return False, f"UNSAFE TRANSFORM REFUSED:\n  {e}", None
        if transform_info:
            return False, (
                "UNEXPECTED TRANSFORM — file matches nested-$$ cron pattern but is "
                "not in RECORD_ONLY_VERSIONS. Halting per 'no uncatalogued patterns' rule.\n"
                f"  file: {filename}\n  info: {transform_info}"
            ), None

    if is_record_only:
        note = " [RECORD-ONLY — DDL not executed]"
    elif transform_info:
        note = f" [TRANSFORM: {transform_info['substitutions']} subs $$→$cron$]"
    else:
        note = ""
    if not quiet:
        print(f"[{idx:3d}/{total}] {filename}{note}", flush=True)

    if is_record_only:
        result = run_supabase_query(sql_text=build_insert_sql(version, name, content))
        if result.returncode != 0:
            return False, "schema_migrations INSERT failed (record-only):\n" + format_error(filename, version, None, result), None
        return True, None, None

    insert_sql = build_insert_sql(version, name, content)  # original content for audit
    tmp_file = None

    if needs_no_wrap(sql_for_execute):
        # CONCURRENTLY DDL — must run as separate single-statement queries
        # (Management API wraps multi-statement queries in implicit transaction)
        TMP_DIR.mkdir(exist_ok=True, parents=True)
        tmp_file = TMP_DIR / filename
        tmp_file.write_text(sql_for_execute)
        statements = split_sql_statements(sql_for_execute)
        for stmt_idx, stmt in enumerate(statements, 1):
            result = run_supabase_query(sql_text=stmt)
            if result.returncode != 0:
                return False, (f"DDL apply failed on statement {stmt_idx}/{len(statements)} of CONCURRENTLY migration:\n"
                               f"  statement: {stmt[:150]!r}\n"
                               + format_error(filename, version, tmp_file, result)), str(tmp_file)
        result = run_supabase_query(sql_text=insert_sql)
        if result.returncode != 0:
            return False, "DDL applied OK but schema_migrations INSERT failed (manual reconcile needed):\n" + format_error(filename, version, tmp_file, result), str(tmp_file)
    elif has_tx_statements(sql_for_execute):
        # File controls its own transaction — send as-is, INSERT separately
        TMP_DIR.mkdir(exist_ok=True, parents=True)
        tmp_file = TMP_DIR / filename
        tmp_file.write_text(sql_for_execute)
        result = run_supabase_query(sql_file=tmp_file)
        if result.returncode != 0:
            return _handle_apply_failure(content, version, name, filename, tmp_file, result, is_wrapped_block=False, quiet=quiet)
        result = run_supabase_query(sql_text=insert_sql)
        if result.returncode != 0:
            return False, "DDL applied OK but schema_migrations INSERT failed (manual reconcile needed):\n" + format_error(filename, version, tmp_file, result), str(tmp_file)
    else:
        # Wrap DDL + INSERT in single transaction
        TMP_DIR.mkdir(exist_ok=True, parents=True)
        tmp_file = TMP_DIR / filename
        tmp_file.write_text(f"BEGIN;\n{sql_for_execute}\n{insert_sql}\nCOMMIT;\n")
        result = run_supabase_query(sql_file=tmp_file)
        if result.returncode != 0:
            return _handle_apply_failure(content, version, name, filename, tmp_file, result, is_wrapped_block=True, quiet=quiet)

    return True, None, str(tmp_file) if tmp_file else None


def _handle_apply_failure(content, version, name, filename, tmp_file, result, is_wrapped_block, quiet):
    """On apply failure: parse error, decide auto-record-only vs halt, perform action."""
    code, msg = parse_pg_error(result.stderr or '')
    if code is None:
        # Unparseable error — halt
        return False, "DDL apply failed (could not parse error code):\n" + format_error(filename, version, tmp_file, result), str(tmp_file)

    if code not in AUTO_SKIP_CODES:
        # Not an auto-skip code — halt
        return False, f"DDL apply failed [{code}]:\n  {msg}\n" + format_error(filename, version, tmp_file, result), str(tmp_file)

    # Auto-skip code triggered. Verify rollback was clean.
    colliding_obj = extract_object_name(msg)
    rollback_ok, rollback_note = verify_clean_rollback(content, colliding_obj, was_wrapped_by_us=is_wrapped_block)
    if not rollback_ok:
        return False, ("AUTO-SKIP REFUSED — partial-apply suspected:\n"
                       f"  error: [{code}] {msg}\n"
                       f"  reason: {rollback_note}\n"
                       + format_error(filename, version, tmp_file, result)), str(tmp_file)

    # Insert schema_migrations row (record-only retroactively)
    insert_result = run_supabase_query(sql_text=build_insert_sql(version, name, content))
    if insert_result.returncode != 0:
        return False, ("AUTO-SKIP failed at the INSERT step (transaction was rolled back so DDL is clean, "
                       "but we cannot record the migration):\n"
                       + format_error(filename, version, tmp_file, insert_result)), str(tmp_file)

    skip_entry = {
        'filename': filename,
        'version': version,
        'pg_error_code': code,
        'pg_error_message': msg,
        'colliding_object': colliding_obj,
        'rollback_verification': rollback_note,
    }
    append_auto_skip_log(skip_entry)
    if not quiet:
        print(f"      ↳ AUTO-SKIPPED [{code}] collision on {colliding_obj!r} — recorded only", flush=True)
    return True, None, str(tmp_file) if tmp_file else None


def cmd_bootstrap():
    sql = (
        "CREATE SCHEMA IF NOT EXISTS supabase_migrations;\n"
        "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations ("
        "  version    text NOT NULL PRIMARY KEY,"
        "  statements text[],"
        "  name       text"
        ");"
    )
    r = run_supabase_query(sql_text=sql)
    if r.returncode != 0:
        print("BOOTSTRAP FAILED")
        print(r.stderr or r.stdout)
        sys.exit(1)
    print("Bootstrap SQL applied (idempotent: CREATE … IF NOT EXISTS).")
    count, err = get_migration_count()
    if err:
        print(f"Count check failed: {err}")
        sys.exit(1)
    print(f"schema_migrations row count: {count}")
    if count != 0:
        print("WARNING: expected 0 rows pre-batch-1.")
        sys.exit(1)


def cmd_count():
    count, err = get_migration_count()
    if err:
        print(f"FAILED: {err}")
        sys.exit(1)
    print(f"schema_migrations rows: {count}")


def run_one_batch(files, start, end, quiet=False):
    """Apply migrations [start..end] (1-based, inclusive).

    Returns (applied, auto_skipped_in_batch, elapsed, cumulative, halt_msg_or_None).
    """
    batch = files[start - 1:end]
    t0 = time.time()
    applied = 0
    skip_baseline = len(AUTO_SKIP_LOG)
    for offset, path in enumerate(batch):
        idx = start + offset
        ok, err_msg, tmp = apply_one(path, idx, len(files), quiet=quiet)
        if not ok:
            elapsed = time.time() - t0
            return applied, len(AUTO_SKIP_LOG) - skip_baseline, elapsed, None, err_msg
        applied += 1
    elapsed = time.time() - t0
    cumulative, count_err = get_migration_count()
    if count_err:
        return applied, len(AUTO_SKIP_LOG) - skip_baseline, elapsed, None, f"count query failed: {count_err}"
    return applied, len(AUTO_SKIP_LOG) - skip_baseline, elapsed, cumulative, None


def print_transform_log_section():
    if not TRANSFORM_LOG:
        return
    print()
    print("--- Transforms applied this run ---")
    for t in TRANSFORM_LOG:
        print(f"  {t['file']}: {t['substitutions']} substitution(s) "
              f"({t['bytes_before']}→{t['bytes_after']} bytes)")
        for i, (op, cl) in enumerate(t['positions'], 1):
            print(f"    pair {i}: opened at byte [{op[0]},{op[1]}), closed at byte [{cl[0]},{cl[1]})")


def cmd_batch(start, end):
    files = sorted(MIGRATIONS_DIR.glob('*.sql'))
    total = len(files)
    if total != 420:
        print(f"ERROR: expected 420 migrations, found {total}")
        sys.exit(1)

    print(f"Batch: migrations {start}–{end} ({end - start + 1} files)\n")
    skip_baseline = len(AUTO_SKIP_LOG)
    applied, skipped, elapsed, cumulative, err = run_one_batch(files, start, end, quiet=False)
    if err:
        print()
        print("=" * 60)
        print("HALT ON ERROR")
        print("=" * 60)
        print(err)
        print()
        print(f"Applied/auto-skipped before halt: {applied} (auto-skips this batch: {skipped})")
        print(f"Elapsed (this batch attempt):     {elapsed:.1f}s")
        count, _ = get_migration_count()
        if count is not None:
            print(f"Cumulative schema_migrations (live): {count}")
        sys.exit(2)

    print()
    print("=" * 60)
    print("Batch complete")
    print("=" * 60)
    print(f"Applied this batch:                 {applied}/{end - start + 1}")
    print(f"Auto-skipped this batch:            {skipped}")
    print(f"Cumulative schema_migrations (live): {cumulative}")
    bd, _ = get_dupe_breakdown()
    if bd:
        total_, distinct, ngroups, extras = bd
        print(f"Distinct versions / dup groups:     {distinct} / {ngroups} (extra rows: {extras})")
    print(f"Elapsed:                            {elapsed:.1f}s")
    if skipped:
        print()
        print("--- Auto-skips this batch ---")
        for s in AUTO_SKIP_LOG[skip_baseline:]:
            print(f"  {s['filename']}  [{s['pg_error_code']}] collision on {s['colliding_object']!r}")
    print_transform_log_section()


def cmd_multi(start_batch, end_batch, batch_size=25, time_limit=180):
    """Run batches start_batch..end_batch with halt-on-anomaly checks.

    Halt conditions:
      - any migration error
      - cumulative count != batch_num * batch_size (off by even one)
      - elapsed > time_limit seconds in any single batch
    """
    files = sorted(MIGRATIONS_DIR.glob('*.sql'))
    total = len(files)
    if total != 420:
        print(f"ERROR: expected 420 migrations, found {total}")
        sys.exit(1)

    print(f"Multi-batch: batches {start_batch}–{end_batch} (size {batch_size}, time limit {time_limit}s)")
    print()

    overall_t0 = time.time()
    for batch_num in range(start_batch, end_batch + 1):
        start = (batch_num - 1) * batch_size + 1
        end = batch_num * batch_size
        expected_cumulative = batch_num * batch_size

        skip_baseline = len(AUTO_SKIP_LOG)
        applied, skipped, elapsed, cumulative, err = run_one_batch(files, start, end, quiet=True)

        if err:
            print()
            print("=" * 60)
            print(f"HALT ON ERROR — batch {batch_num} (migrations {start}–{end})")
            print("=" * 60)
            print(err)
            print()
            print(f"Applied this batch before halt: {applied} (auto-skips: {skipped})")
            print(f"Elapsed (this batch attempt):   {elapsed:.1f}s")
            count, _ = get_migration_count()
            if count is not None:
                print(f"Cumulative schema_migrations (live): {count}")
            sys.exit(2)

        if cumulative != expected_cumulative:
            print()
            print("=" * 60)
            print(f"HALT ON CUMULATIVE MISMATCH — batch {batch_num}")
            print("=" * 60)
            print(f"Expected cumulative after batch {batch_num}: {expected_cumulative}")
            print(f"Actual (live query):                       {cumulative}")
            sys.exit(3)

        if elapsed > time_limit:
            print()
            print("=" * 60)
            print(f"HALT ON TIME ANOMALY — batch {batch_num}")
            print("=" * 60)
            print(f"Batch {batch_num} elapsed {elapsed:.1f}s exceeds limit {time_limit}s.")
            print(f"Cumulative is correct ({cumulative}) — DB state OK, but pace suggests an issue.")
            sys.exit(4)

        bd, _ = get_dupe_breakdown()
        if bd:
            total, distinct, ngroups, extras = bd
            print(f"Batch {batch_num:2d}: {applied}/{batch_size} in {elapsed:5.1f}s, "
                  f"cumulative {cumulative} (distinct {distinct}, {ngroups} dup groups, {extras} extra), "
                  f"auto-skips this batch: {skipped}")
        else:
            print(f"Batch {batch_num:2d}: {applied}/{batch_size} in {elapsed:5.1f}s, "
                  f"cumulative {cumulative}, auto-skips this batch: {skipped}")
        if skipped:
            for s in AUTO_SKIP_LOG[skip_baseline:]:
                print(f"           ↳ {s['filename']}  [{s['pg_error_code']}] collision on {s['colliding_object']!r}")

    overall_elapsed = time.time() - overall_t0
    print()
    print(f"All batches {start_batch}–{end_batch} clean. Total elapsed {overall_elapsed:.1f}s.")
    print_transform_log_section()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == 'bootstrap':
        cmd_bootstrap()
    elif cmd == 'count':
        cmd_count()
    elif cmd == 'batch':
        cmd_batch(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == 'multi':
        # multi <start_batch> <end_batch>
        cmd_multi(int(sys.argv[2]), int(sys.argv[3]))
    else:
        print(__doc__)
        sys.exit(1)
