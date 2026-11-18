// Stand-in for @sendgrid/mail in the test server: records the message, sends nothing.
import { describeMail, record } from "../record.mjs";

const response = [{ statusCode: 202, body: "", headers: {} }, {}];

class MailService {
  setApiKey() {}
  setClient() {}
  setSubstitutionWrappers() {}
  async send(data) {
    for (const msg of Array.isArray(data) ? data : [data])
      record(describeMail(msg));
    return response;
  }
  async sendMultiple(data) {
    record(describeMail(data));
    return response;
  }
}

const mail = new MailService();
export { MailService };
export default mail;
