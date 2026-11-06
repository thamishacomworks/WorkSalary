# WorkSalary

A simple app for workers in Japan to track daily work,
day and night shifts, and monthly earnings across multiple companies.

## Live App

https://work-salary.netlify.app/

## Features

- Add, rename, and delete companies.
- Record work dates, day or night shifts, earnings in JPY, and notes.
- Edit and delete work entries.
- View monthly earnings by company or across all companies.
- View work entries in a table.
- Filter entries by month, company, and shift.
- See monthly day and night shift counts.
- Download and restore JSON backups.
- Use offline after the app has loaded successfully online.
- Add the app to the Home Screen on Android and iPhone.

## Install on Your Phone

### iPhone

1. Open the live app in Safari.
2. Tap Share → Add to Home Screen.
3. Enable Open as Web App if available.
4. Tap Add.

### Android

1. Open the live app in Chrome.
2. Open the browser menu.
3. Choose Add to Home screen or Install app.
4. Follow the instructions.

## Data and Privacy

No registration or login is required.

Work records are stored locally in the browser on your device.
They are not synced between devices or uploaded to a cloud database.

Clearing browser data or losing your device may result in data loss.
Download backups regularly and keep a copy somewhere safe.

Backup files contain your work and earnings information.
Do not upload them to this public repository.

## Backup and Restore

- Open Backup → Download Backup to save your records as a JSON file.
- Choose Restore a Backup to import a previously saved file.

Restoring a backup replaces all current companies and work entries.

## Earnings Calculations

Earnings are calculated from the amounts entered by the user.
Taxes, insurance, and other deductions are not calculated.

Each work entry counts as one shift.
A day entry and a night entry on the same date count as two shifts.

## Run Locally

1. Download or clone this repository.
2. Open the project folder in Visual Studio Code.
3. Open index.html using the Live Server extension.
4. Use the localhost address provided by Live Server.

Offline support requires localhost or an HTTPS connection.
Opening index.html directly with a file:// address does not enable it.

## Built With

- HTML
- CSS
- JavaScript
- Local Storage
- Service Worker
- Web App Manifest
