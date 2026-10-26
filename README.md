# PD Calendar

    npm install
    npm run dev                     # http://localhost:5173 (React) + API on :3001

Production:

    npm run build
    ADMIN_PIN=yourpin npm start     # http://localhost:3001

Data is stored in `data.json` and uploaded PDFs are stored in `uploads/` (both created automatically). Back up both occasionally. PDF uploads are limited to 20 MB.
Click "Admin" and enter the PIN to add or delete calendar items.

Render persistence:

- Add a persistent disk mounted at `/var/data`.
- Set `DATA_DIR` to `/var/data` and set `ADMIN_PIN` to a private value.
- Use `npm run build` as the build command and `npm start` as the start command.
- Copy any existing `data.json` into the disk before switching over, or the app will start with an empty calendar.
