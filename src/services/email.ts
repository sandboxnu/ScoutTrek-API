import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import sgMail from '@sendgrid/mail';

const templatesFolder = path.join(__dirname, '..', '..', 'templates');

export async function sendResetPasswordEmail(email: string, token: string): Promise<boolean> {
    const emailTemplateSource = fs.readFileSync(path.join(templatesFolder, 'reset_password.hbs'), "utf8");

    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const template = handlebars.compile(emailTemplateSource);
    const htmlToSend = template({token})

    const msg = {
        from: {
            email: "info@scouttrek.com",
            name: "ScoutTrek",
        },
        to: email,
        subject: "ScoutTrek Password Reset",
        html: htmlToSend
    };

    try {
        await sgMail.send(msg);
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}