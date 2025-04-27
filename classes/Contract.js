const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const puppeteer = require('puppeteer');


class Contract {
    constructor() {}

    async getAll(_accessToken) {
        const result = {
            state: false,
            data: [],
            error: null,
        };

        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://ravkavonline.co.il/api/transaction/?page_size=20',
            headers: {
                'accept': '*/*',
                'accept-language': 'en',
                'authorization': `Bearer ${_accessToken}`,
                'content-type': 'application/json',
                'priority': 'u=1, i',
                'referer': 'https://ravkavonline.co.il/en/store/account/transaction-history',
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'x-ravkav-version': 'sw=ravkav-web id=null version=null d=36cae277397a4f13933ca4ecde1627ed'
            }
        };

        await axios.request(config)
            .then((response) => {
                result['state'] = true;
                result['data'] = response.data;
            })
            .catch((error) => {
                result['state'] = false;
                result['error'] = error.response.data.detail;
            });

        return result;
    }

    /**
     * Export contract into pdf
     * @param _url {string}
     * @param _savePath {string}
     * @return {Promise<*>}
     */
    async exportContractPDF(_url, _savePath) {
        (async () => {
            const url = _url;


            // Launch Puppeteer with minimal configuration and use system-installed Chromium
            const browser = await puppeteer.launch({
                executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', // windows
                // executablePath: '/usr/bin/chromium-browser', // Path to the Chromium executable - rpi4
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

                const imgsToReplace = document.querySelectorAll('img.qr.img-responsive');
                imgsToReplace.forEach(img => {
                    img.src = 'https://ravkavonline.co.il/qr?content=' + img.src;
                });        
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
            await pdfPage.pdf({ path: _savePath, format: 'A4' });
        
            await browser.close();
            console.log('PDF created successfully');
        })();
    }

    /**
     * Extract contract details
     * @param _contract {object}
     * {
     *     "uid": "x",
     *     "created": "2024-05-21T18:41:42.210043+00:00",
     *     "card": {
     *         "modified": "2024-05-21T18:41:52.743898Z",
     *         "last_used": "2024-05-21T18:41:52.743898Z",
     *         "name": "Daily",
     *         "serial_number": "x",
     *         "receive_renewal_reminders": true,
     *         "hidden": false
     *     },
     *     "card_serial": "x",
     *     "contract_display_name": "Daily pass including train, up to 40km",
     *     "contract_type_display": "Daily pass",
     *     "period_description": "22/5/2024",
     *     "counter_description": null,
     *     "counter_value": null,
     *     "origin_destination_description": null,
     *     "billing_status": "charged",
     *     "payment": {
     *         "method": "x",
     *         "payment_means": "x",
     *         "was_authorized": true,
     *         "was_charged": true,
     *         "was_refunded": false,
     *         "authorized_amount": 4200,
     *         "charged_amount": 4200
     *     },
     *     "created_by_device": null,
     *     "purchase_approval_link": "https://ravkavonline.co.il/en/transaction/x/purchase-approval/",
     *     "refund_approval_link": null,
     *     "reservation_approval_link": null,
     *     "is_loading_contract": true,
     *     "is_loading_profile": false
     * }
     * @return {object}
     */
    getDetails(_contract) {
        const details = {}

        if (_contract?.contract_display_name) {
            details['contract_display_name'] = _contract.contract_display_name;
        }
        if (_contract?.payment?.charged_amount) {
            // Convert agorot to NIS
            const chargedAmountInAgorot = _contract.payment.charged_amount;
            details['charged_amount'] = chargedAmountInAgorot / 100;
        }
        if (_contract?.period_description) {
            details['contract_for_date'] = _contract.period_description;
        }

        return details;
    }
}

module.exports = Contract;