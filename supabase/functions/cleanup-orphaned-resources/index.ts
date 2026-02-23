/**
 * Cleanup Orphaned Resources
 * 
 * Safety net for the edge case where a file is uploaded to the
 * teaching-resources storage bucket but the corresponding database
 * insert in the resources table fails (e.g. network drop, tab close).
 * 
 * Runs daily at 3 AM via pg_cron. Finds storage files with no matching
 * resources.file_path record and deletes them.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: only allow cron / internal calls
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("INTERNAL_CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Get all known file_paths from the database
    const { data: dbResources, error: dbError } = await supabase
      .from("resources")
      .select("file_path");

    if (dbError) throw dbError;

    const knownPaths = new Set((dbResources || []).map((r: any) => r.file_path));

    // 2. List all org folders in the bucket
    const { data: orgFolders, error: folderError } = await supabase.storage
      .from("teaching-resources")
      .list("", { limit: 1000 });

    if (folderError) throw folderError;

    const orphanedFiles: string[] = [];

    // 3. For each org folder, list files and check against DB
    for (const folder of orgFolders || []) {
      if (!folder.id) continue; // skip if not a folder

      const { data: files, error: listError } = await supabase.storage
        .from("teaching-resources")
        .list(folder.name, { limit: 1000 });

      if (listError) {
        console.error(`Error listing folder ${folder.name}:`, listError.message);
        continue;
      }

      for (const file of files || []) {
        if (!file.name || file.id === null) continue;
        const fullPath = `${folder.name}/${file.name}`;
        if (!knownPaths.has(fullPath)) {
          orphanedFiles.push(fullPath);
        }
      }
    }

    // 4. Delete orphaned files in batches
    let deletedCount = 0;
    if (orphanedFiles.length > 0) {
      // Supabase storage remove accepts up to ~100 files at a time
      const batchSize = 100;
      for (let i = 0; i < orphanedFiles.length; i += batchSize) {
        const batch = orphanedFiles.slice(i, i + batchSize);
        const { error: deleteError } = await supabase.storage
          .from("teaching-resources")
          .remove(batch);

        if (deleteError) {
          console.error(`Error deleting batch:`, deleteError.message);
        } else {
          deletedCount += batch.length;
        }
      }
    }

    console.log(
      `Orphaned resource cleanup complete: ${deletedCount} files deleted out of ${orphanedFiles.length} orphaned found.`
    );

    return new Response(
      JSON.stringify({
        orphaned_found: orphanedFiles.length,
        deleted: deletedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Cleanup error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
