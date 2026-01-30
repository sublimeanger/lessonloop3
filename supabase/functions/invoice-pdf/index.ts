import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Health check endpoint
  if (url.searchParams.get("health") === "true") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Simple test - create a minimal PDF
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    page.drawText("Test Invoice", {
      x: 50,
      y: 750,
      size: 24,
      font: helvetica,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="test.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
