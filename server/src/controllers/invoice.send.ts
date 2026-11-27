import { Request, Response } from "express";
import sgMail from "@sendgrid/mail";
import {
  invoiceHtmlTemplate,
  invoiceTextTemplate,
} from "../email-templates/invoice-html.js";
import { decode } from "html-entities";
import { getNoReplyFromEmail } from "../middleware/emailNotifier.js";
import { buildInvoiceCopyList } from "../services/invoice.copyList.js";
import { supabase } from "../services/invoice.client.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendInvoiceEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: "Recipient email is required" });

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (invoiceError || !invoice)
      return res.status(404).json({ error: "Invoice not found" });

    // Fetch client for CC logic
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", invoice.client_id)
      .maybeSingle();
    if (clientError || !client)
      return res.status(404).json({ error: "Client not found" });

    // Build CC list
    const cc = buildInvoiceCopyList(client);

    // Download PDF from Supabase Storage
    if (!invoice.document_path || !invoice.document_file_name) {
      return res
        .status(400)
        .json({ error: "Invoice PDF not found for this invoice" });
    }
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("invoices")
      .download(invoice.document_path.replace(/&#x2F;/g, "/"));
    if (pdfError || !pdfData)
      return res.status(500).json({ error: "Failed to download invoice PDF" });
    // Read as buffer
    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());
    const pdfBase64 = pdfBuffer.toString("base64");

    // Prepare email content
    const templateVars = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      clientName: client.company_name,
      clientEmail: client.email_address1,
      grandTotal: invoice.grand_total,
      currency: invoice.currency,
      messageOnInvoice: invoice.invoice_data?.messageOnInvoice,
    };
    const html = invoiceHtmlTemplate(templateVars);
    const text = invoiceTextTemplate(templateVars);
    const subject = `Invoice #${invoice.invoice_number} for ${client.company_name}`;

    // Prepare the main PDF attachment
    const attachments = [
      {
        content: pdfBase64,
        filename: decode(invoice.document_file_name),
        type: decode(invoice.document_mime_type || "application/pdf"),
        disposition: "attachment",
      },
    ];

    // Add additional attachments from invoice_data.attachments
    if (Array.isArray(invoice.invoice_data?.attachments)) {
      for (const att of invoice.invoice_data.attachments) {
        if (
          att.uploadStatus === "uploaded" &&
          att.filePath &&
          att.fileName &&
          att.bucketName
        ) {
          try {
            const { data: fileData, error: fileError } = await supabase.storage
              .from(att.bucketName)
              .download(decode(att.filePath));
            if (fileError || !fileData) {
              console.error(
                "[SendGrid] Failed to download attachment:",
                att.fileName,
                fileError
              );
              continue;
            }
            const fileBuffer = Buffer.from(await fileData.arrayBuffer());
            attachments.push({
              content: fileBuffer.toString("base64"),
              filename: decode(att.fileName),
              type: decode(att.fileType || "application/octet-stream"),
              disposition: "attachment",
            });
          } catch (err) {
            console.error(
              "[SendGrid] Error downloading attachment:",
              att.fileName,
              err
            );
          }
        }
      }
    }

    const sendPayload = {
      to: email,
      cc: cc.length > 0 ? cc : undefined,
      from: getNoReplyFromEmail(),
      subject,
      html,
      text,
      attachments,
    };
    console.log("[SendGrid] Sending email with payload:", {
      from: sendPayload.from,
      subject: sendPayload.subject,
      attachments: sendPayload.attachments.map((a) => ({
        filename: a.filename,
        type: a.type,
        size: a.content.length,
      })),
    });
    try {
      await sgMail.send(sendPayload);
    } catch (error: any) {
      console.error("[SendGrid] Error object:", error);
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        error.response.body &&
        error.response.body.errors
      ) {
        console.error("[SendGrid] Error details:", error.response.body.errors);
        return res.status(500).json({
          error: "Failed to send invoice email",
          details: error.response.body.errors,
        });
      }
      return res.status(500).json({ error: "Failed to send invoice email" });
    }

    // Update invoice email_sent fields (not version/version_history)
    await supabase
      .from("invoices")
      .update({
        email_sent: true,
        email_sent_date: new Date().toISOString(),
        invoice_sent_to: email,
      })
      .eq("id", id);

    // After successful send, set locals for activityLogger
    res.locals.invoiceSendResult = {
      invoiceNumber: invoice.invoice_number,
      clientId: client.id,
      clientName: client.company_name,
      cc,
    };

    return res
      .status(200)
      .json({ success: true, message: "Invoice email sent successfully" });
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return res.status(500).json({ error: "Failed to send invoice email" });
  }
};
