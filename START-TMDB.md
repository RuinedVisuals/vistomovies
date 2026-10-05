# Afterdark — TMDB edition

Τοπική εφαρμογή React/Vite + Python. Κατάλογος ταινιών χωρίς εξάρτηση από προβολές.

## Εγκατάσταση / αναβάθμιση στα Windows
1. Σταμάτησε τους δύο servers με Ctrl+C. Κράτησε αντίγραφο του παλιού project αν έχεις κάνει δικές σου αλλαγές.
2. Αντέγραψε τα περιεχόμενα του φακέλου `movies` του ZIP στο `D:\Documents\Projects\develop\movies`, με αντικατάσταση των κοινών αρχείων.
3. Από PowerShell:

```powershell
cd "D:\Documents\Projects\develop\movies"
Copy-Item .env.example .env
notepad .env
```

Στο αρχείο αντικατάστησε το `PASTE_NEW_TOKEN_HERE` με το νέο **API Read Access Token** του TMDB. Αποθήκευσε. Μη βάλεις το API key: αρκεί μόνο το Read Access Token.
Το `.env` είναι δίπλα στο `requirements.txt`, όχι μέσα στο `frontend`.
Αν υπάρχει ήδη σωστό `.env`, παράλειψε το Copy-Item για να μην το αντικαταστήσεις.

Πρώτο terminal:
```powershell
py -m pip install -r requirements.txt
py -m showtimes serve
```

Δεύτερο terminal:
```powershell
cd "D:\Documents\Projects\develop\movies\frontend"
npm.cmd install
npm.cmd run dev
```

Άνοιξε http://127.0.0.1:5173 — το 8787 είναι μόνο το API.

## Λειτουργίες
- Δημοφιλείς, υψηλή βαθμολογία και προσεχώς από TMDB, με σελίδες.
- Αναζήτηση μεταφρασμένων και πρωτότυπων τίτλων.
- Αφίσες, backdrop, ημερομηνία, διάρκεια, είδη, χώρες, περίληψη, σκηνοθέτης, cast, TMDB rating και αριθμός ψήφων.
- Trailer ως σύνδεσμος YouTube όπου υπάρχει.
- Ελληνική περίληψη με αγγλικό fallback στις λεπτομέρειες.
- Προσωπική λίστα στον συγκεκριμένο browser, με νέα TMDB IDs. Η παλιά λίστα προβολών δεν μεταφέρεται αυτόματα.
- Cache 15 λεπτών στη μνήμη του server, έως 300 απαντήσεις.
- Χωρίς σύνδεση δεν φορτώνονται νέα στοιχεία. Τα αποθηκευμένα cards παραμένουν στη λίστα· οι εικόνες και οι λεπτομέρειες χρειάζονται internet.

Τα πεδία εμφανίζονται όταν υπάρχουν στο TMDB. Το «Προσεχώς» δεν αποτελεί πρόγραμμα προβολών ή εγγύηση ημερομηνίας για ελληνικό σινεμά.
Δεν γίνεται μαζικό download ολόκληρης της βάσης. Δεν εμφανίζονται στοιχεία από το παλιό Athinorama snapshot στη νέα οθόνη.
Τα παλιά backend εργαλεία παραμένουν για συμβατότητα, δεν εκτελούνται αυτόματα.

## Διαπιστευτήρια
Το ZIP δεν περιέχει token ή API key. Κράτησε το νέο token μόνο στο τοπικό `.env` ή στο environment `TMDB_READ_TOKEN`. Ποτέ σε React/VITE_ μεταβλητή, commit ή screenshot. Αν έστειλες κάποιο token σε chat, αντικατάστησέ το από τις ρυθμίσεις/υποστήριξη TMDB.

## Attribution
Περιλαμβάνεται το επίσημο TMDB logo και το προβλεπόμενο κείμενο στα Credits. Η δωρεάν χρήση αφορά μη εμπορικό project σύμφωνα με τους όρους TMDB.
https://developer.themoviedb.org/docs/faq
https://www.themoviedb.org/about/logos-attribution

## Έλεγχοι
TypeScript και production build. 10 Python unit tests. Browser checks με δοκιμαστικές απαντήσεις API: σφάλμα χωρίς token, αποθήκευση μετά από reload, λεπτομέρειες, Escape, πλάτη 320/390/1440 και απουσία JS errors. Δεν έγινε ζωντανό authenticated request με το token του χρήστη· θα ελεγχθεί τοπικά μετά τη ρύθμιση.

## Update: Κινηματογράφοι + Mapbox + Letterboxd

Η ενότητα «Σινεμά» επανήλθε με τους 61 κινηματογράφους του αρχικού project, αναζήτηση ονόματος/περιοχής χωρίς τόνους, φίλτρο θερινών και αγαπημένα αποθηκευμένα στον browser.

Το `frontend/.env.local` περιέχει το public Mapbox token που δόθηκε για αυτό το project. Δεν χρειάζεται επικόλληση. Είναι public client token (pk.), όχι TMDB secret. Μην αντικαταστήσεις το backend `.env` που ήδη έφτιαξες. Μετά την αντιγραφή του update χρειάζεται `npm.cmd install` στο frontend και επανεκκίνηση του Vite.

Ο Mapbox χρησιμοποιεί dark-v11, zoom controls και προαιρετικό κουμπί εντοπισμού χρήστη. Η τοποθεσία χρήστη ζητείται μόνο αν πατηθεί το σχετικό κουμπί. Η επιλογή σινεμά δείχνει διεύθυνση, εστιάζει στον χάρτη και παρέχει εξωτερικό σύνδεσμο οδηγιών μετάβασης.

**Πληρότητα θέσεων:** Το παλιό dataset περιείχε διευθύνσεις αλλά όχι συντεταγμένες. Αυτή η έκδοση έχει μία θέση από OSM (Δεξαμενή). Για τους υπόλοιπους κινηματογράφους, όταν επιλεγούν, γίνεται Mapbox προσωρινό geocoding της διεύθυνσης και εμφανίζεται πορτοκαλί pin ως εκτιμώμενη θέση. Αν δεν βρεθεί διεύθυνση, εμφανίζεται μήνυμα. Δεν υπάρχουν 61 επιβεβαιωμένα pins. Τα αποτελέσματα Mapbox δεν αποθηκεύονται σε αρχείο, βάση ή localStorage. Πλήρης επιβεβαίωση διευθύνσεων/εισόδων παραμένει εκκρεμής. Το Mapbox έχει δική του τιμολόγηση και όρια χρήσης: https://www.mapbox.com/pricing

Το `frontend/public/cinemas.json` περιέχει τον κατάλογο. Κάθε εγγραφή δέχεται `coordinates: [longitude, latitude]` και `coordinateSource` για επιβεβαιωμένες θέσεις. Τα στοιχεία ονόματος/διεύθυνσης/θερινού είναι η αρχική τοπική λίστα, όχι νέα αδειοδοτημένη συλλογή ούτε επιβεβαίωση τρέχουσας λειτουργίας. Οι συντεταγμένες OSM υπόκεινται σε ODbL, © OpenStreetMap contributors: https://www.openstreetmap.org/copyright

Στις λεπτομέρειες κάθε ταινίας υπάρχει Letterboxd link με `https://letterboxd.com/tmdb/{id}`. Πρόκειται για σύνδεσμο προς την ταινία, όχι εισαγωγή ratings/reviews ή συγχρονισμό λογαριασμού. Επίσημη τεκμηρίωση: https://letterboxd.com/about/film-data/

Έλεγχος Mapbox: το style endpoint απάντησε HTTP 200 με το public token. Δεν έχει επιβεβαιωθεί η ακρίβεια geocoding για όλες τις διευθύνσεις. Τα ωράρια προβολών εξακολουθούν να είναι εκτός του νέου interface μέχρι να συνδεθεί κατάλληλη πηγή.
