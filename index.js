const fetch = require("node-fetch");
const moment = require("moment");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
    
     try {
        const { queryStringParameters } = event;
        // Need to pass path params as subId in the URL i.e /:subId
        const submissionId = event.pathParameters.subId;
        // Also need to pass email a query param in the URL i.e /:subId?email=email-id
        const email = queryStringParameters.email;
        if (!submissionId || !email) {
            return {
                statusCode: 301,
                headers: {
                    Location: process.env.ERROR_URL
                }
            }
        }

        const token = process.env.PAPERFORM_API_KEY;
        const headers = {
        Authorization: `Bearer ${token}`
        };

        const url = `https://api.paperform.co/v1/submissions/${submissionId}`;

        const subRes = await fetch(url, {
            method: "GET",
            headers
        });

        const data = await subRes.json();

        if (data && data.results && data.results.submission && data.results.submission.charge) {
            const productsSelected = data.results.submission.charge.products;
            const selectedSKUs = Object.keys(productsSelected);
            let items = [];

            selectedSKUs.forEach(product => {
                items.push({
                    name: productsSelected[product].summary,
                    currency: "eur",
                    quantity: productsSelected[product].quantity,
                    amount: productsSelected[product].total * 100
                });
            });

            const selectedProductNames = items.map(item => item.name);
            
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                customer_email: email,
                mode: "payment",
                line_items: items,
                payment_intent_data: {
                    description: `Charges to ${email} for the purchase of Package(s) ${selectedProductNames.toString()} on the ${moment().format('DD/MM/YYYY')} `,
                    metadata: {
                        products: JSON.stringify(data.results.submission.charge.products),
                        sku: selectedSKUs.toString(),
                        submissionId: submissionId,
                        formId: data.results.submission.form_id
                    }
                },
                allow_promotion_codes: true,
                cancel_url: process.env.CANCEL_URL,
                success_url: process.env.SUCCESS_URL,
            });
            
            return {
                statusCode: 301,
                headers: {
                    Location: session.url
                }
            };
        }
    } catch (error) {
        console.log("--Error while creating session--",error);
        return {
                statusCode: 301,
                headers: {
                    Location: process.env.ERROR_URL
                }
            };
    }
};
