import nodemailer from 'nodemailer';
import mg from 'nodemailer-mailgun-transport';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

const templatesFolder = path.join(__dirname, '..', '..', 'templates');

export async function sendResetPasswordEmail(email: string, token: string): Promise<boolean> {
    const emailTemplateSource = fs.readFileSync(path.join(templatesFolder, 'reset_password.hbs'), "utf8");

    const mailgunAuth = {
        auth: {
            api_key: process.env.MAILGUN_API_KEY!,
            domain: process.env.MAILGUN_DOMAIN!
        }
    }
    
    const smtpTransport = nodemailer.createTransport(mg(mailgunAuth));
    const template = handlebars.compile(emailTemplateSource);
    const htmlToSend = template({token})

    const mailOptions = {
        from: "info@scouttrek.com",
        to: email,
        subject: "ScoutTrek Password Reset",
        html: htmlToSend
    };

    try {
        await smtpTransport.sendMail(mailOptions);
        return true;
    } catch (err) {
        console.log("Uh oh", err);
        return false;
    }
}