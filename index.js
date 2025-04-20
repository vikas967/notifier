require("dotenv").config();
const { Client } = require("@notionhq/client");
const nodemailer = require("nodemailer");

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.DATABASE_ID;

// Setup email
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Store already notified IDs (in-memory; store to file/db if needed)
let notified = new Set();

async function checkTasks() {
    const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
            property: "Status",
            select: {
                equals: "Done",
            },
        },
    });

    for (let page of response.results) {
        const id = page.id;
        if (notified.has(id)) continue;

        const props = page.properties;
        const description = props.Description?.title[0]?.text?.content || "No description";
        const assignedTo = props["Assigned To"]?.people[0]?.name || "Unassigned";
        const date = props.Date?.date?.start || "No date";
        const team = props.Team?.multi_select.map(item => item.name).join(", ") || "No team";

        // Send Email
        await transporter.sendMail({
            from: `"Task Notifier" <${process.env.EMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `✅ Task Completed: ${description}`,
            text: `A task has been marked as Done.

Description: ${description}
Assigned To: ${assignedTo}
Date: ${date}
Team: ${team}
    `,
        });

        console.log(`Email sent for task: ${description}`);
        notified.add(id); // Mark as notified
    }
}

// Poll every 5 minutes
setInterval(checkTasks, 5 * 60 * 1000);
checkTasks(); // Initial check
