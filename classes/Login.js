
const axios = require('axios');

class Login {
    username = null;
    password = null;
    verification_code = null;

    constructor(_username, _password, _verificationCode) {
        this.username = _username;
        this.password = _password;
        this.verification_code = _verificationCode;
    }

    async perform() {
        const result = {
            state: false,
            access_token: null,
            refresh_token: null,
            error: null,
        };

        const headers = {
            'accept': 'application/json',
            'accept-language': 'en',
            'content-type': 'application/json',
            'origin': 'https://ravkavonline.co.il',
            'priority': 'u=1, i',
            'referer': 'https://ravkavonline.co.il/en/store/login',
            'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'x-ravkav-version': 'sw=ravkav-web id=null version=null d=36cae277397a4f13933ca4ecde1627ed',
        };

        await axios.post('https://ravkavonline.co.il/api/o/login/', {
            username: this.username,
            password: this.password,
            verification_code: this.verification_code,
        }, {headers})
            .then(response => {
                result['state'] = true;
                result['access_token'] = response.data.access_token;
                result['refresh_token'] = response.data.refresh_token;
            })
            .catch(error => {
                result['state'] = false;
                result['error'] = error.response.data['detail'];
            });

        return result;

    }

    /**
     * Send verification code to user email
     * @return {Promise<{state: boolean, error: null}>}
     */
    async sendVerificationCode() {
        const result = {
            state: false,
            error: null,
        };

        const requestData = {
            username: this.username,
            password: this.password,
        };

        const config = {
            headers: {
                'accept': 'application/json',
                'accept-language': 'en',
                'content-type': 'application/json',
                'cookie': '_gid=GA1.3.842127920.1716403834; _ga=GA1.1.1236318337.1716403834; _gat=1; _ga_2RXV0YKEH3=GS1.1.1716415775.3.0.1716415779.0.0.0',
                'origin': 'https://ravkavonline.co.il',
                'priority': 'u=1, i',
                'referer': 'https://ravkavonline.co.il/en/store/login',
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

        await axios.post('https://ravkavonline.co.il/api/o/issue-verification-code/', requestData, config)
            .then(response => {
                    result['state'] = true;
                })
            .catch(error => {
                result['state'] = false;
                result['error'] = error.response.data['detail'];
            });

        return result;
    }
}

module.exports = Login;