import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

// Initialize Firebase Admin
// Note: In a real production environment, you'd use a service account key.
// Here we attempt to initialize with the project ID.
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();
const fcm = admin.messaging();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Serve the service worker with the config injected
  app.get("/firebase-messaging-sw.js", (req, res) => {
    const swTemplate = `
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "${firebaseConfig.apiKey}",
  authDomain: "${firebaseConfig.authDomain}",
  projectId: "${firebaseConfig.projectId}",
  storageBucket: "${firebaseConfig.projectId}.appspot.com",
  messagingSenderId: "${firebaseConfig.appId.split(':')[2]}", // This is a guess, usually it's the sender ID
  appId: "${firebaseConfig.appId}"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
    `;
    res.setHeader("Content-Type", "application/javascript");
    res.send(swTemplate);
  });

  // API Route to add an event and notify users
  app.post("/api/events", async (req, res) => {
    try {
      const eventData = req.body;
      const { city, title } = eventData;

      // 1. Add event to Firestore
      const eventRef = await db.collection("events").add({
        ...eventData,
        createdAt: new Date().toISOString(),
      });

      // 2. Find all FCM tokens for this city
      // We'll query users' fcmTokens subcollections
      // This is a bit complex with subcollections, so we might need a collection group query
      // or we can store tokens in a top-level collection for easier querying.
      // For now, let's assume we have a top-level 'fcm_tokens' collection for simplicity
      // OR we use a collection group query if enabled.
      
      const tokensSnapshot = await db.collectionGroup("fcmTokens")
        .where("city", "==", city)
        .get();

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: `Nouvel événement à ${city} !`,
            body: `${title} vient d'être ajouté. Ne le manquez pas !`,
          },
          tokens: tokens,
        };

        const response = await fcm.sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} messages`);
      }

      res.status(201).json({ id: eventRef.id });
    } catch (error) {
      console.error("Error adding event and notifying:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
