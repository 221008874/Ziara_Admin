const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const sa = JSON.parse(readFileSync("D:\\proj\\Server\\clinic-server\\src\\main\\resources\\smartclinicadmin-firebase-adminsdk-fbsvc-f9ab48a940.json"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const baseUrl = "https://github.com/221008874/client-/releases/download/Ziara";
(async () => {
  await db.collection("app_versions").doc("dr").set({
    version: "1.2.1",
    buildNumber: 0,
    downloadUrl: `${baseUrl}/Ziara-DR-v1.2.0.zip`,
    msiUrl: "",
    releaseNotes: "- Testing the update splash screen",
    releaseDate: new Date().toISOString().split("T")[0],
    minVersion: "1.0.0",
    forceUpdate: false,
    status: "published",
    fileSize: 226329583,
    checksum: "",
    updatedAt: new Date(),
  });
})().catch(console.error);
