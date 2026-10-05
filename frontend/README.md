# Visto — React cinema app

Mobile-first React + TypeScript + Vite frontend για το υπάρχον τοπικό Athens Showtimes API. iPhone-inspired glass navigation, ημιδιαφανή sheets, κάρτες αφισών, responsive desktop layout. Μόνο τοπική λειτουργία. Δεν έχει γίνει deployment.

## Εγκατάσταση στον δικό σου φάκελο

Βάλε τον φάκελο **frontend** μέσα στο:

`D:\Documents\Projects\develop\movies`

Το αποτέλεσμα πρέπει να είναι:

```
movies/
  showtimes/           ← το υπάρχον Python project
  data/
  requirements.txt
  frontend/
    package.json
    src/
    public/
    ...
```

Κράτα ανοιχτό το terminal όπου τρέχεις `py -m showtimes serve`.
Άνοιξε **δεύτερο terminal**:

```powershell
cd "D:\Documents\Projects\develop\movies\frontend"
npm install
npm run dev
```

Άνοιξε **http://127.0.0.1:5173**.

Χρειάζεσαι Node.js 22.12+ ή Node.js 24. Αν το PowerShell απαγορεύει το npm.ps1, χρησιμοποίησε `npm.cmd install` και `npm.cmd run dev` χωρίς να αλλάξεις execution policy.

## Τι λειτουργεί

- Προβολή ανά ταινία ή κινηματογράφο.
- Ημερομηνίες με αλλαγή εβδομάδας και ημερολόγιο στο desktop.
- Αναζήτηση τίτλου, κινηματογράφου ή διεύθυνσης χωρίς εξάρτηση από τόνους.
- Φίλτρα είδους, κινηματογράφου και ώρας.
- Ταξινόμηση τίτλων/ωρών.
- Αγαπημένες ταινίες αποθηκευμένες στο localStorage της συγκεκριμένης συσκευής/browser. Δεν υπάρχει λογαριασμός ή cloud sync.
- Κάρτα λεπτομερειών με ώρες, αίθουσες, αρχικό ωράριο και link στην πηγή. Οι σύνδεσμοι δεν παρουσιάζονται ως checkout εισιτηρίων.
- Keyboard-accessible native dialog, Escape για κλείσιμο, loading/empty/error states και reduced-motion υποστήριξη.
- Έλεγχος παλαιότητας δεδομένων/τελευταίου σφάλματος.

## Πώς συνδέεται

Το frontend καλεί `/api/showtimes?date=YYYY-MM-DD`.
Ο Vite proxy προωθεί το request στο `http://127.0.0.1:8787/showtimes?date=...`.
Δεν χρειάζεται αλλαγή του Python backend ή CORS για αυτή τη διάταξη.

Το κουμπί ανανέωσης ξαναδιαβάζει τη βάση μέσω API. **Δεν τρέχει scraper**.

Αν το API είναι κλειστό ή δεν απαντά σε 5 δευτερόλεπτα, χρησιμοποιείται το `public/snapshot.json`, με εμφανή ένδειξη. Είναι δείγμα προγράμματος **1–7 Οκτωβρίου 2026** από το προηγούμενο πακέτο. Η εμφάνιση μιας κάρτας δεν αποτελεί επιβεβαίωση ότι η προβολή παραμένει διαθέσιμη.

Το catalog (`public/catalog.json`) αντιστοιχίζει τα movieSourceUrl του προηγούμενου dataset με είδη/αφίσες και τα ονόματα σινεμά με διευθύνσεις. Είναι στατικό συνοδευτικό αρχείο αυτού του δείγματος. Νέες ταινίες συνεχίζουν να εμφανίζονται με τίτλο/ωράρια αλλά χρειάζονται ενημέρωση catalog για εικόνα/είδος. Αποθηκεύτηκαν 47 διαθέσιμες αφίσες χαμηλής ανάλυσης· όπου δεν υπήρχε επιτυχημένη λήψη, εμφανίζεται κάρτα τίτλου, χωρίς άσχετη εικόνα. Για τελικές αφίσες υψηλής ανάλυσης μπορεί αργότερα να προστεθεί TMDB με επιβεβαιωμένη αντιστοίχιση.

Η γραμματοσειρά Manrope φορτώνεται από Google Fonts. Χωρίς internet χρησιμοποιείται η system font (στο iPhone η γραμματοσειρά του συστήματος). Οι αποθηκευμένες αφίσες και το δείγμα είναι τοπικά.

## Build

```powershell
npm run build
npm run preview
```

Preview: http://127.0.0.1:4173. Το preview έχει τον ίδιο proxy προς το API.

## Μελλοντικό iOS / Android μέσω Capacitor

Υπάρχει `capacitor.config.json` με `webDir: dist`. Δεν έχουν δημιουργηθεί/δοκιμαστεί native projects ούτε APK/IPA. Όταν το θελήσεις:

```powershell
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/android
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Απαιτείται Android Studio με το κατάλληλο SDK. Για iOS: Mac + Xcode, εγκατάσταση `@capacitor/ios`, `npx cap add ios` και sync/open.

Το web frontend μπαίνει στο native app. **Ο Python server δεν μεταφέρεται στο κινητό** και το `127.0.0.1` στο κινητό δείχνει το ίδιο το κινητό. Στην παρούσα διαμόρφωση το native app μπορεί να χρησιμοποιήσει το ενσωματωμένο snapshot για offline demo. Για ενημερούμενα δεδομένα θα χρειαστεί άλλη σύνδεση backend ή εισαγωγή νέου τοπικού dataset. Δεν χρειάζεται να δημοσιευτεί τίποτα τώρα.

## Αρχεία

- `src/App.tsx`: κύρια views, φίλτρα, watchlist.
- `src/components/Details.tsx`: λεπτομέρειες και προβολές.
- `src/components/Poster.tsx`: εικόνα / title fallback.
- `src/lib/data.ts`: API και snapshot fallback.
- `src/lib/types.ts`: types και date helpers.
- `src/styles/main.css`: design tokens, glass styling, responsive layouts.

Πηγές references: τα δύο screenshots σου. Το Behance reference επέστρεψε 403 και δεν χρησιμοποιήθηκε ως πλήρως προσβάσιμο design. Το όνομα Afterdark είναι προσωρινό branding.

## Έλεγχοι παράδοσης

Το TypeScript check και το production build ολοκληρώθηκαν επιτυχώς. Έγινε browser έλεγχος σε 390px, 320px και desktop: φόρτωση 33 ταινιών / 51 σινεμά για 5/10/2026, αποθήκευση αγαπημένου και διατήρηση μετά από reload, άνοιγμα/κλείσιμο λεπτομερειών, αναζήτηση «Μικρόκοσμος», φίλτρο μετά τις 22:00, άδεια μελλοντική ημερομηνία και snapshot fallback με το API μη διαθέσιμο. Δεν καταγράφηκαν JavaScript page errors. Στα 320px επιβεβαιώθηκε απουσία οριζόντιας υπερχείλισης. Δεν έχει δοκιμαστεί σε πραγματική συσκευή iPhone ή native WebView.
