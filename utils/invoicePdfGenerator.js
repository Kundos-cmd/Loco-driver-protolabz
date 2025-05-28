const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const chromium = require("chrome-aws-lambda");
// const puppeteer = require("puppeteer");

function injectTemplateVars(html, data) {
  return html.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || '');
}

exports.generateInvoicePDF = async (
  values,
  invoiceId,
  cashierInfo,
  customerInfo
) => {
	const templatePath = path.join(__dirname, "../templates/invoiceTemplate.html");
	const htmlRaw = fs.readFileSync(templatePath, "utf-8");

//   const html = injectTemplateVars(htmlRaw, {
//     invoiceId,
//     date: values[0],
//     dueDate: values[2],
//     itemName: values[3],
//     amount: values[10],
//     platformCharge: values[12] > 0 ? values[12] : 0,
//     tax: values[11] > 0 ? values[11] : 0,
//     discount: values[13] > 0 ? values[13] : 0,
// 	additional_cost: values[14] > 0 ? values[14] : 0,
//     total:
//       values[10] +
//       (values[10] * values[12]) / 100 +
// 	  values[14] +
//       (values[10] * values[11]) / 100 -
//       (values[10] * values[13]) / 100,
//     customerName: customerInfo.name,
//     customerEmail: customerInfo.email,
//     cashierName: cashierInfo.name,
//     cashierEmail: cashierInfo.email,
//     notes: values[8],
//     terms: values[9],
//   });

	const amount = values[10];
	const platformCharge = values[12];
	const tax = values[11];
	const discount = values[13];
	const additionalCost = values[14];

	const total = (
		amount +
		(amount * platformCharge) / 100 +
		additionalCost +
		(amount * tax) / 100 -
		(amount * discount) / 100
	);

	const html = injectTemplateVars(htmlRaw, {
		invoiceId,
		date: values[0],
		dueDate: values[2],
		itemName: values[3],
		amount: `$${amount.toFixed(2)}`,
		platformCharge: platformCharge > 0 ? `${platformCharge}%` : '',
		tax: tax > 0 ? `${tax}%` : '',
		discount: discount > 0 ? `-${discount}%` : '',
		additional_cost: additionalCost > 0 ? `$${additionalCost.toFixed(2)}` : '',
		total: `$${total.toFixed(2)}`,
		customerName: customerInfo.name,
		customerEmail: customerInfo.email,
		cashierName: cashierInfo.name,
		cashierEmail: cashierInfo.email,
		notes: values[8],
		terms: values[9],
		status: values[4]
	});

	// const browser = await puppeteer.launch();
	const browser = await puppeteer.launch({
		args: chromium.args,
		defaultViewport: chromium.defaultViewport,
		executablePath: await chromium.executablePath || '/usr/bin/chromium-browser',
		headless: chromium.headless,
		ignoreHTTPSErrors: true
	});
	
	const page = await browser.newPage();

	await page.setContent(html, { waitUntil: "networkidle0" });

	const pdfPath = path.join(__dirname, `../invoices/invoice-${invoiceId}.pdf`);
	await page.pdf({
		path: pdfPath,
		format: "A4",
		printBackground: true,
	});

	await browser.close();

	return pdfPath;
};
