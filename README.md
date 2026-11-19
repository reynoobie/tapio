# tap.io

React + Vite frontend for GitHub Pages, with Firebase Authentication, Firestore, Cloud Storage, and a callable Cloud Functions backend. The registered Firebase project is `tap-io-517cd`.

## Finish Firebase setup

1. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**.
2. Create a **Cloud Firestore** database in **Production mode**. Choose the database location carefully. The backend functions use `asia-southeast1` (Singapore).
3. Enable **Cloud Storage** and create the default bucket. Cloud Functions deployment and Cloud Storage require the **Blaze billing plan**. Configure billing alerts before live testing. This repository does not enable billing or deploy resources automatically.
4. Install Node.js 22.12 or newer on the Node 22 release line, then open a terminal in this folder and run

   ```sh
   npm ci
   npm --prefix functions ci
   npm install -g firebase-tools
   firebase login
   firebase use tap-io-517cd
   firebase deploy --only firestore:rules,storage,functions
   ```

5. Under **Authentication → Settings → Authorized domains**, add the GitHub Pages hostname `reynoobie.github.io` if this is the account you use for hosting.

The Firebase Web app configuration in `src/lib/firebase.js` is public client configuration. Passwords stay with Firebase Authentication. No service account keys belong in this repository. All database writes go through the callable backend, which verifies the Firebase user and administrator record. Deploy the included rules together with the functions.

## Publish the frontend on GitHub Pages

1. Create an empty GitHub repository named `tapio` in your account.
2. Put the contents of this folder at the repository root. Include `.github/workflows/pages.yml`, `functions/`, the lockfiles, and the Firebase rule files. Exclude `node_modules`, `dist`, `.git`, `.openai`, local environment files, and debug logs.
3. Open repository **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Push to the `main` branch. The included workflow installs dependencies, lints, builds with the repository's Pages base path, and deploys the frontend.

GitHub Pages builds use hash routes so that direct NFC and QR links work without a server fallback. After the workflow completes, the site has addresses such as `https://reynoobie.github.io/tapio/#/p/your-username`. The actual address comes from the Pages deployment result. Copy links from the website so the repository prefix and hash are included.

## Create the first administrator

1. Register your own real account through the deployed website. Choose your permanent username and verify the email.
2. In Firebase **Authentication → Users**, copy your account's UID.
3. In Firestore Console, create collection `admins`, add a document whose ID is exactly that UID, and add a boolean field `enabled` with value `true`.
4. Refresh the website. Open `/admin` using the app's Admin link.
5. Open **Products → Add starter catalog**, then review the prices, availability, and stock. Set your GCash number and QR under **Payments**.

Only a project owner using Firebase Console or a trusted server can grant administrator access. A customer cannot create an admin record through the website.

## Test your physical NFC card

1. Sign in as administrator and open **NFC Cards → Create card**.
2. Save the generated card URL and the one-time activation code. The code is displayed only at creation, then stored as a server-only hash.
3. Write the complete generated URL as a URL record using your NFC writing app. Keep the card rewritable during testing.
4. Open that URL as the customer, sign in, and claim it with the saved activation code.
5. Customize and publish a profile. Publish both Personal and Professional if you want to switch between them.
6. Tap the physical card with a second phone. The public profile must open while that phone is signed out. Switching active mode changes the profile at the same card URL.
7. Check Save Contact, profile links, and QR sharing on that phone.

Card creation registers an identifier in Firebase. The browser does not program a physical NFC tag. The permanent card URL is generated for the host where the website is running. Generate and program your card after GitHub Pages is live.

## Data and payments

- New accounts start with blank drafts and no published profile, cards, or orders. Old browser demo records are never treated as real accounts.
- Authenticated drafts, published modes, carts, setup progress, and message read markers are stored per Firebase UID.
- Public profiles are separate projections. Hidden contact values and hidden sections are excluded by the backend before publication.
- Cards are claimed atomically with a secret activation code. Customers can rename and disable only their own cards. Transfer requests are saved for administrator follow-up in Firestore's `transferRequests` collection.
- Checkout reads prices and availability from the server catalog. Request IDs prevent duplicate orders on retries. Delivery address and phone are saved with the private order.
- Payments stay pending until an administrator reviews uploaded proof. Inventory is deducted once when payment is marked paid. Shipment updates require a paid order.
- Support messages are private to their customer and administrators. Administrators select a customer conversation in Help. Uploaded receipt and chat images use private Storage paths. Published profile images are copied to public paths.
- Analytics count daily unique interactions per IP address, profile, and action. The first tap, outbound link interaction, and Save Contact action for each day are recorded.
- Account closure removes the public profile and disables cards. Private account and order records remain in Firestore. It does not erase the Firebase Authentication identity or implement a data-erasure request.

The guest Try Builder remains a sample design sandbox. Publishing and account actions use Firebase. Autosave shows Saved only after the backend confirms the write. A failed cloud write shows an error and can be retried using Save Draft.

## Local development and checks

```sh
npm ci
npm --prefix functions ci
npm run dev
npm run lint
npm run build
npm --prefix functions run check
npm --prefix functions test
```

Unit tests run without Firebase credentials. Integration tests use the Firebase Auth, Firestore, and Storage emulators and never use production customer records.

```sh
firebase emulators:exec --only auth,firestore,storage --project tap-io-517cd 'npm --prefix functions test'
```

The backend integration suite invokes the callable handler directly against the emulated database, while checking client access using the real Firestore rules. To test the actual HTTP callable wrapper and frontend together, start all emulators with `firebase emulators:start`, copy `.env.example` to `.env.local`, set `VITE_FIREBASE_EMULATORS=true`, and start Vite in a second terminal.

To preview the GitHub Pages layout locally, set `VITE_GITHUB_PAGES=true` and build with `npm run build -- --base /tapio/`.

The Firebase backend and GitHub Pages deployment require your authenticated setup. Including Firebase configuration in the source does not enable services, deploy rules or functions, or publish the GitHub repository.
