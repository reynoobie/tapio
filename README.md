# tap.io — no-billing setup

React + Vite on GitHub Pages, with Firebase Email/Password Authentication and Cloud Firestore on the **Spark plan**. No billing account, Firebase Storage, Cloud Functions, or Firebase Hosting is required. Project: `tap-io-517cd`.

## Windows: finish the backend setup

1. Keep the Firebase project on **Spark**. Do not click Upgrade project.
2. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**. Add `reynoobie.github.io` under **Authentication → Settings → Authorized domains**.
3. Open **Firestore Database → Create database**, choose **Standard edition**, select a location, and start in **Production mode**. Do not enable Storage or Functions.
4. Download this updated source and extract it. Open PowerShell **in the folder containing `firebase.json` and `package.json`**. Run each line separately:

   ```powershell
   npm.cmd ci
   npx.cmd firebase-tools login
   npx.cmd firebase-tools deploy --only firestore --project tap-io-517cd
   ```

   `Test-Path .\firebase.json` must return `True` before deployment. The old command containing `storage,functions` must not be used with this version.

5. The GitHub Pages frontend is `https://reynoobie.github.io/tapio/`. Its workflow publishes updates pushed to `main`. If using another repository, enable **Settings → Pages → Source → GitHub Actions** and add its hostname to Firebase authorized domains.

The Firebase browser configuration is public configuration. Passwords are handled by Firebase Authentication. Never commit service-account keys or Firebase CLI login credentials.

## Create the first administrator

1. Create your real account through the website and verify your email.
2. Copy its UID from **Firebase Authentication → Users**.
3. In Firestore Console, create an `admins` collection. Create a document with that exact UID and a boolean field `enabled: true`.
4. Refresh the site and open Admin. In **Products**, choose **Add starter catalog** and review prices and stock. In **Payments**, add your GCash number and QR.

Only the Firebase project owner can grant administrator access. A customer cannot grant it through the site.

## Test a physical NFC card

1. As administrator, open **NFC Cards → Create card**.
2. Save its generated URL and the activation code shown once. Only a SHA-256 hash of the random activation secret is stored in the private database.
3. Write the complete URL to the NFC tag with your NFC writing app. Keep the tag rewritable while testing.
4. Open the URL as the customer, sign in and enter the saved activation code to claim the card.
5. Customize and publish your profile. Publish both Personal and Professional to enable the active-mode switch.
6. Tap the card with another signed-out phone. It should open the published profile. Test Save Contact, links and QR. Switching active mode keeps the same NFC URL.

GitHub Pages links contain the repository prefix and hash, for example `https://reynoobie.github.io/tapio/#/p/your-username`. Copy the generated full URL from the website; do not remove the hash or prefix. The browser registers cards but does not program physical tags.

## What is saved

- Real accounts start with blank profiles, no cards and no orders. The guest Try Builder remains a sample design sandbox.
- Account metadata, carts, drafts, published modes, checklist progress and message-read markers sync through Firestore under the Firebase UID. Personal and Professional profile records are separate so edits in one mode preserve the other.
- Public profiles use separate documents. Publication removes hidden contact values and hidden sections; rules reject an unsanitized public projection.
- Claims are atomic and require the correct random activation code. Customers can rename or disable their own cards. Transfer requests are saved for admin follow-up.
- Checkout reads the catalog and rules independently verify quantities, names, prices and totals. A request ID prevents duplicate orders on retries. **An order supports up to eight design lines**, with quantities up to 100 per line, to keep rule validation within Firebase limits. Split larger design selections into separate orders.
- Payment remains Pending until an admin checks the uploaded receipt and marks it Paid or Rejected. Marking Paid deducts stock once; shipping requires Paid.
- Chat and receipt images are private to the owner and administrators. Images explicitly published on a profile or used as the store GCash QR are public.
- Analytics record browser-session interactions per day and action, not verified people or IP addresses. Public contact forms and analytics are best-effort, and can be abused to consume the free quota. There is no trusted server rate limiter on this plan.
- Closing an account removes its public profiles, makes its images private, and disables its cards. Private order and account records remain; the Firebase Auth identity is retained. Remove administrator access in Console before closing an admin account.

## Free-plan limits

This version stores **compressed images as separate Firestore documents**, rather than using billed object storage. Uploads accept JPEG, PNG, WebP and GIF, convert to a still WebP image, and resize/compress to at most 180,000 data-URL characters (about 135 KB of image bytes). This is intended for testing and a small installation; it is not unlimited image hosting. The image field is excluded from indexing.

Firestore Standard includes one free database with **1 GiB stored data, 50,000 document reads/day, 20,000 writes/day and 20,000 deletes/day**. Spark also has other limits, including network and authentication limits. Keep the project on Spark: if a quota is exhausted, functionality can stop until it resets; it does not automatically upgrade to paid billing. Avoid repeatedly uploading unused images, as those records remain until removed. Review usage in Firebase Console.

Official limits: https://firebase.google.com/docs/firestore/quotas and https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## Development and verification

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
npm.cmd test
```

The unit tests need no credentials. Integration tests require Java 21 and the Firestore emulator. They exercise client operations against the actual rules, including denied cross-account access, tampered prices, hidden contacts, activation codes, receipt review, private chat and account closure:

```powershell
npx.cmd firebase-tools emulators:exec --only firestore --project tap-io-517cd "npm.cmd test"
```

For a full local app test, start `npx.cmd firebase-tools emulators:start --only auth,firestore`, copy `.env.example` to `.env.local`, set `VITE_FIREBASE_EMULATORS=true`, then run Vite in another terminal. The emulators use disposable local data, not production records.

For a Pages-style build: set `VITE_GITHUB_PAGES=true` and run `npm.cmd run build -- --base /tapio/`.

Source configuration and a successful frontend deployment do not enable Authentication, create the production database, or deploy its rules. Finish the Console setup and Firestore deployment above before testing real sign-up and card claims.
