// pm2 start app.js --name "RavKav-NodeJS" -- start

require('dotenv').config()
const express = require('express');
const Login = require('./classes/Login.js');
const Contract = require('./classes/Contract.js');
const { PDFDocument } = require('pdf-lib');
const XLSX = require('xlsx');
const path = require('path');

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const fs = require('fs');
const app = express();
const port = 3007;


const loginData = {
    username: process.env.RAVKAV_USERNAME,
    password: process.env.RAVKAV_PASSWORD,
    verification_code: process.env.RAVKAV_VERIFICATION_CODE,
};

// Store temp data
const tempData = {
    access_token: null,
};

app.get('/test', async (req, res) => {
    const url = 'https://ravkavonline.co.il/en/transaction/f51b8fe6-4a40-4e0c-a880-a0f82b153233/purchase-approval/';
})

app.get('/login', async (req, res) => {
    // Perform login
    const LoginIns = new Login(loginData.username, loginData.password, loginData.verification_code);
    const loginResult = await LoginIns.perform();

    if (loginResult.state) {
        // Temporary store access_token
        tempData['access_token'] = loginResult.access_token;
    }
    else {
        // Send verification code to user
        // const issueVerificationCodeResult = await LoginIns.sendVerificationCode();
    }

    res.send(loginResult);
})

/**
 * Delete generated PDFs
 */
app.get('/delete_pdfs', async (req, res) => {
    try {
        fs.rmSync('./pdf', { recursive: true, force: true });
        res.send({
            state: true,
        })
        fs.mkdirSync('./pdf');
    }
    catch (error) {
        res.send({
            state: false,
            error: JSON.stringify(error)
        })
    }
})

/**
 * Send verification code to user
 */
app.get('/send_verification_code', async (req, res) => {
    const LoginIns = new Login(loginData.username, loginData.password, loginData.verification_code);
    const issueVerificationCodeResult = await LoginIns.sendVerificationCode();

    res.send(issueVerificationCodeResult);
})

app.get('/login_with_code', async (req, res) => {
    // const passedVerificationCode = req.params.verification_code;
    const passedVerificationCode = req.query.verification_code;

    if (!passedVerificationCode) {
        res.send({
            state: false,
            error: 'missing_verification_code',
        });
        return;
    }

    // Perform login
    const LoginIns = new Login(loginData.username, loginData.password, passedVerificationCode??loginData.verification_code);
    const loginResult = await LoginIns.perform();

    if (loginResult.state) {
        // Temporary store access_token
        tempData['access_token'] = loginResult.access_token;
    }
    else {
        // Send verification code to user
        // const issueVerificationCodeResult = await LoginIns.sendVerificationCode();
    }

    res.send(loginResult);
})

app.get('/set_access_token', async (req, res) => {
    const passedAccessToken = req.query.access_token;
    const result = {
        state: false,
        error: '',
    };

    if (passedAccessToken) {
        result['state'] = true;
        tempData['access_token'] = passedAccessToken;
    }
    else {
        result['state'] = false;
        result['error'] = 'Invalid access token';
    }

    res.send(result);
})

/**
 * Get Sheet stats
 * @param month {number} - E.g. 05
 * @param year {number} - E.g. 2024
 * @param access_token {string}
 */
app.get('/get_sheet', async (req, res) => {
    const passedMonth = req.query.month;
    const passedYear = req.query.year;
    let passedAccessToken = req.query.accessToken;

    console.log('Received /get_sheet')

    if (!passedMonth || !passedYear || !passedAccessToken) {
        res.send({
            state: false,
            error: 'missing_data',
        })
        return;
    }

    if (passedAccessToken == 'x') {
        passedAccessToken = tempData['access_token'];
    }

    console.log(`Month: ${passedMonth}, Year: ${passedYear}, Token: ${passedAccessToken}`);


    // Store passed access_token
    tempData['access_token'] = passedAccessToken;

    // Get all contracts
    const ContractIns = new Contract();
    const contractsResult = await ContractIns.getAll(tempData['access_token']);
    if (!contractsResult.state) {
        res.send(contractsResult);
        return;
    }

    const contracts = contractsResult.data.data.results;

    if (!contracts.length) {
        res.send({
            state: false,
            error: 'Failed to get user contracts',
        });
        return;
    }

    console.log(`Found ${contracts.length} contracts (before filtering)`);


    const filterDataByMonth = (data, month, year) => {
        month = Number(month);
        year = Number(year);
        return data.filter(item => {
            const date = new Date(item.created);
            return date.getMonth() + 1 === month && date.getFullYear() === year; // getMonth() is zero-based
        });
    };

    let filteredContracts = filterDataByMonth(contracts, passedMonth, passedYear);

    if (!filteredContracts.length) {
        res.send({
            state: false,
            error: 'No contracts in the provided month/year',
        });
        return;
    }

    console.log(`Filetered by period and found ${filteredContracts.length} results`);

    // Since new contracts on top, reverse them
    filteredContracts = [...filteredContracts].reverse();

    console.log(filteredContracts)

    // Iterate over contracts and generate pdf
    const contractsDetails = [];
    // for (const [i, contract] of filteredContracts.entries()) {
    for (let i = 0; i < filteredContracts.length; i++) {
        contract = filteredContracts[i];
        const contractDate = contract['period_description'];
        const contractUrl = filteredContracts[i]['purchase_approval_link'];

        // Get contract details
        console.log(`Getting contract details`);
        contractsDetails.push(ContractIns.getDetails(contract));
    }

    // --- Create XLSX file in Hebrew format ---
    console.log('Creating Hebrew format XLSX file...');

    // Hebrew day names mapping
    const hebrewDayNames = {
        0: "ראשון",
        1: "שני",
        2: "שלישי",
        3: "רביעי",
        4: "חמישי",
        5: "שישי",
        6: "שבת"
    };

    // Create the workbook
    const workbook = XLSX.utils.book_new();

    // Create the worksheet with a structured approach
    // Start with an empty array that we'll fill with data
    const wsData = [];

    // Add the title row (A1)
    wsData.push([`עלות טעינת כרטיס - ${passedMonth}-${passedYear}`, ``, ""]);

    // Add the name row (A2)
    wsData.push(["", "", ""]);

    // Add an empty row for spacing
    wsData.push(["", "", ""]);

    // Add the header row for the table
    wsData.push(["יום", "תאריך", "עלות"]);

    // Calculate total cost while adding data rows
    let totalCost = 0;

    // Add the data rows
    contractsDetails.forEach(contract => {
        // Parse the date (assuming format is DD/MM/YYYY)
        const dateParts = contract.contract_for_date.split('/');
        const contractDate = new Date(
            parseInt(dateParts[2]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[0])
        );

        // Format the date as DD-MM-YYYY for display
        const formattedDate = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;

        // Get day name in Hebrew
        const dayName = hebrewDayNames[contractDate.getDay()];

        // Add the row data
        wsData.push([dayName, formattedDate, contract.charged_amount]);

        // Sum up the total cost
        totalCost += contract.charged_amount;
    });

    // Add an empty row before the total
    wsData.push(["", "", ""]);

    // Add the total cost row
    wsData.push(["סה״כ", "", totalCost]);

    // Create the worksheet from the data array
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Set right-to-left direction for the worksheet
    worksheet['!RTL'] = true;

    // Set all cells to be center-aligned - both horizontally and vertically
    // First determine the range of cells in the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    // Now iterate over all cells and set them to center alignment
    for(let R = range.s.r; R <= range.e.r; ++R) {
        for(let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({r: R, c: C});

            // If the cell exists, add style properties to it
            if(worksheet[cellAddress]) {
                worksheet[cellAddress].s = worksheet[cellAddress].s || {};
                // Set horizontal alignment to center
                worksheet[cellAddress].s.alignment = {
                    horizontal: 'center',
                    vertical: 'center'
                };
            } else {
                // If cell doesn't exist, create it with center alignment
                worksheet[cellAddress] = {
                    v: '',
                    s: {
                        alignment: {
                            horizontal: 'center',
                            vertical: 'center'
                        }
                    }
                };
            }
        }
    }

    // Set bold font for headers and title
    const headerAddresses = [
        XLSX.utils.encode_cell({r: 0, c: 0}), // Title
        XLSX.utils.encode_cell({r: 3, c: 0}), // Header יום
        XLSX.utils.encode_cell({r: 3, c: 1}), // Header תאריך
        XLSX.utils.encode_cell({r: 3, c: 2}), // Header עלות חופשי יומי
        XLSX.utils.encode_cell({r: wsData.length - 1, c: 0}) // Total row
    ];

    headerAddresses.forEach(address => {
        if(worksheet[address]) {
            worksheet[address].s = worksheet[address].s || {};
            worksheet[address].s.font = {
                bold: true,
                sz: 12 // Font size
            };
        }
    });

    // Make the title cell span across all columns
    if (!worksheet['!merges']) worksheet['!merges'] = [];

    // Merge the title cell across all columns
    worksheet['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } } // Title row
    );

    // Merge the name cell across all columns
    worksheet['!merges'].push(
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } } // Name row
    );

    // Adjust column widths
    const colWidths = [
        { wch: 10 }, // Day column
        { wch: 15 }, // Date column
        { wch: 15 }  // Cost column
    ];
    worksheet['!cols'] = colWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'חופשי יומי');

// Define the directory path where the Excel file will be saved
    const dirPath = path.join(__dirname, 'pdf');

    // Check if the directory exists, and create it if it doesn't
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('✅ Directory "pdf" created');
    }

    // Define the Excel filename
    const excelFilePath = path.join(dirPath, `RavKav_${passedMonth}_${passedYear}.xlsx`);

    // Write the Excel file
    XLSX.writeFile(workbook, excelFilePath);
    console.log(`✅ Hebrew Excel file created: ${excelFilePath}`);

    // Send the file as a response
    fs.readFile(excelFilePath, async (err, data) => {
        if (err) {
            res.send({
                state: false,
                error: err.message,
            });
        } else {
            const base64Data = data.toString('base64'); // Convert binary data to base64
            res.send({
                state: true,
                fileName: `RavKav_${passedMonth}_${passedYear}.xlsx`,
                file: base64Data,  // Send base64-encoded file
            });
        }
    });

    // // Send the file as a response
    // res.download(excelFilePath, (err) => {
    //     if (err) {
    //         console.error("Error downloading the file:", err);
    //         res.status(500).send('Error while sending the file');
    //     } else {
    //         // Delete the file after sending it
    //         fs.unlink(excelFilePath, (unlinkErr) => {
    //             if (unlinkErr) {
    //                 console.error('Error deleting file:', unlinkErr);
    //             }
    //             else {
    //                 console.log('✅ File deleted after sending');
    //             }
    //         });
    //     }
    // });

    // console.log(contractsDetails)
});

/**
 * Get contracts
 * @param month {number} - E.g. 05
 * @param year {number} - E.g. 2024
 * @param access_token {string}
 */
app.get('/get_pdfs', async (req, res) => {
    const passedMonth = req.query.month;
    const passedYear = req.query.year;
    let passedAccessToken = req.query.accessToken;

    console.log('Received Get_PDFs')

    if (!passedMonth || !passedYear || !passedAccessToken) {
        res.send({
            state: false,
            error: 'missing_data',
        })
        return;
    }

    if (passedAccessToken == 'x') {
        passedAccessToken = tempData['access_token'];
    }

    console.log(`Month: ${passedMonth}, Year: ${passedYear}, Token: ${passedAccessToken}`);


    // Store passed access_token
    tempData['access_token'] = passedAccessToken;

    // Get all contracts
    const ContractIns = new Contract();
    const contractsResult = await ContractIns.getAll(tempData['access_token']);
    if (!contractsResult.state) {
        res.send(contractsResult);
        return;
    }

    const contracts = contractsResult.data.data.results;

    if (!contracts.length) {
        res.send({
            state: false,
            error: 'Failed to get user contracts',
        });
        return;
    }

    console.log(`Found ${contracts.length} contracts (before filtering)`);


    const filterDataByMonth = (data, month, year) => {
        month = Number(month);
        year = Number(year);
        return data.filter(item => {
            const date = new Date(item.created);
            return date.getMonth() + 1 === month && date.getFullYear() === year; // getMonth() is zero-based
        });
    };

    let filteredContracts = filterDataByMonth(contracts, passedMonth, passedYear);

    if (!filteredContracts.length) {
        res.send({
            state: false,
            error: 'No contracts in the provided month/year',
        });
        return;
    }

    console.log(`Filetered by period and found ${filteredContracts.length} results`);

    // Since new contracts on top, reverse them
    filteredContracts = [...filteredContracts].reverse();

    // Iterate over contracts and generate pdf
    const pdfFiles = [];
    const contractsDetails = [];
    // for (const [i, contract] of filteredContracts.entries()) {
    for (let i = 0; i < filteredContracts.length; i++) {
        contract = filteredContracts[i];
        const contractDate = contract['period_description'];
        const contractUrl = filteredContracts[i]['purchase_approval_link'];
        const contractPdfFilePath = `./pdf/${i}_${passedMonth}_${passedYear}_${contractDate.replaceAll('/', '_')}.pdf`;
        pdfFiles.push(contractPdfFilePath);

        // Await the export of the contract PDF
        console.log(`Trying to export contract PDF: ${contractDate}, Url: ${contractUrl}`);
        await ContractIns.exportContractPDF(contractUrl, contractPdfFilePath);

        /*
        (async () => {
            const url = contractUrl;

            // Launch Puppeteer with minimal configuration and use system-installed Chromium
            const browser = await puppeteer.launch({
                executablePath: '/usr/bin/chromium-browser', // Path to the Chromium executable
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080'
                ]
            });

            const page = await browser.newPage();

            // Go to the page and wait for the content to load
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Remove elements with the class 'hidden-print'
            await page.evaluate(() => {
                const elements = document.querySelectorAll('.hidden-print');
                elements.forEach(element => element.remove());
            });

            // Get the modified body content
            const bodyContent = await page.evaluate(() => document.body.innerHTML);

            // Create a new HTML document
            const htmlTemplate = `
            <!DOCTYPE html>
            <html lang="en" dir="ltr">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="referrer" content="strict-origin-when-cross-origin">
                <meta name="theme-color" content="#342D6E">
                <title>Purchase Confirmation</title>
                <meta name="description" content="Load your Rav Kav travel card straight from home using the mobile app or the website and pay with a credit card.">
                <link rel="stylesheet" href="https://ravkavonline.co.il/static/styles/css/styles.web.0168f70369f5.css">
            </head>
            <body>
                ${bodyContent}
            </body>
            </html>
            `;

            // Create a new page with the modified HTML
            const pdfPage = await browser.newPage();
            await pdfPage.setContent(htmlTemplate);
            await pdfPage.pdf({ path: contractPdfFilePath, format: 'A4' });

            await browser.close();
            console.log('PDF created successfully');
        })();
        */

        // Get contract details
        console.log(`Getting contract details`);
        contractsDetails.push(ContractIns.getDetails(contract));
    }

    setTimeout(async () => {
        // Merge the PDFs
        console.log(`Trying to merge ${pdfFiles.length} PDFs`);
        const outputFilePath = `./pdf/RavKav_${passedMonth}_${passedYear}.pdf`;
        await mergePDFs(pdfFiles, outputFilePath)
            .then(async () => {
                console.log('PDFs merged successfully!');

                // Set headers for file download
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=RavKav_${passedMonth}_${passedYear}.pdf`);

                // Send the merged PDF file as response
                const fileStream = await fs.createReadStream(outputFilePath);

                // fileStream.pipe(res);

                // Read the PDF file and send it as a response
                fs.readFile(outputFilePath, async (err, data) => {
                    if (err) {
                        res.send({
                            state: false,
                            error: err.message,
                            details: contractsDetails,
                        });
                    } else {
                        res.send({
                            state: true,
                            fileName: `RavKav_${passedMonth}_${passedYear}.pdf`,
                            file: data,
                        });
                    }
                });
            })
            .catch(error => {
                console.error('Error merging PDFs:', error);
                res.send({
                    state: false,
                    error: 'Error merging PDFs (try cmd again): ' + JSON.stringify(error),
                });
            });
    }, 30000)
});


// Function to merge PDFs
async function mergePDFs(pdfFiles, outputFilePath) {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    for (const pdfFile of pdfFiles) {
        // Load the PDF file
        const pdfBytes = fs.readFileSync(pdfFile);
        const pdf = await PDFDocument.load(pdfBytes);

        // Copy pages from the current PDF to the merged PDF
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => {
            mergedPdf.addPage(page);
        });
    }

    // Serialize the merged PDF to bytes
    const mergedPdfBytes = await mergedPdf.save();

    // Write the merged PDF to the output file
    fs.writeFileSync(outputFilePath, mergedPdfBytes);
}


async function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    });
}

app.listen(port, function (err) {
    if (err) console.log(err);
    console.log("Server listening on port:", port);
});