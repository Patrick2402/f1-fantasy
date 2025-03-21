// Importy potrzebnych modułów
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');

// Inicjalizacja aplikacji Express
const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = 443;

// Konfiguracja middleware
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static('public'));
app.set('view engine', 'ejs');

// Dane kierowców
const drivers = {
  "Top Drivers": [
    "Max Verstappen", 
    "Lewis Hamilton", 
    "Charles Leclerc", 
    "Lando Norris", 
    "George Russell", 
    "Oscar Piastri"
  ],
  "Midfield Drivers": [
    "Fernando Alonso", 
    "Pierre Gasly", 
    "Esteban Ocon", 
    "Lance Stroll", 
    "Carlos Sainz Jr.", 
    "Alexander Albon", 
    "Yuki Tsunoda", 
    "Nico Hülkenberg", 
    "Liam Lawson"
  ],
  "Rookies": [
    "Andrea Kimi Antonelli", 
    "Jack Doohan", 
    "Oliver Bearman", 
    "Isack Hadjar", 
    "Gabriel Bortoleto"
  ]
};

// Dane o punktacji kierowców
let driverPoints = {};
let userSelections = {};
let races = []; // Przechowywanie historii wyścigów

// Inicjalizacja pliku z danymi, jeśli nie istnieje
const dataPath = path.join(__dirname, 'data', 'points.json');
const dataDir = path.join(__dirname, 'data');

// Upewnij się, że katalog data istnieje
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Załaduj dane, jeśli plik istnieje, w przeciwnym razie utwórz nowe dane
if (fs.existsSync(dataPath)) {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  driverPoints = data.driverPoints || {};
  userSelections = data.userSelections || {};
  races = data.races || []; // Dodaj ładowanie historii wyścigów
} else {
  // Inicjalizacja danych punktów dla każdego kierowcy
  Object.values(drivers).flat().forEach(driver => {
    driverPoints[driver] = 0;
  });
  
  // Zapisz początkowe dane
  fs.writeFileSync(
    dataPath, 
    JSON.stringify({ driverPoints, userSelections, races }, null, 2), 
    'utf8'
  );
}

// Funkcja zapisująca dane do pliku
const saveData = () => {
  fs.writeFileSync(
    dataPath, 
    JSON.stringify({ driverPoints, userSelections, races }, null, 2), 
    'utf8'
  );
};

// Funkcja pobierająca listę wyścigów z API Ergast dla konkretnego roku
async function fetchRaceSchedule(year) {
  try {
    const response = await axios.get(`https://ergast.com/api/f1/${year}.json`);
    
    if (response.data && response.data.MRData && response.data.MRData.RaceTable) {
      const races = response.data.MRData.RaceTable.Races;
      return races.map(race => ({
        round: race.round,
        name: race.raceName,
        circuit: race.Circuit.circuitName,
        date: race.date,
        time: race.time || "",
        country: race.Circuit.Location.country,
        locality: race.Circuit.Location.locality
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching race schedule:', error);
    return [];
  }
}

const pointsSystem = {
  1: 3,  // 1. miejsce - 3 punkty
  2: 2,  // 2. miejsce - 2 punkty 
  3: 1   // 3. miejsce - 1 punkt
};


function mapDriverName(apiDriverName) {
  const driverMapping = {
    "verstappen": "Max Verstappen",
    "hamilton": "Lewis Hamilton",
    "leclerc": "Charles Leclerc",
    "norris": "Lando Norris",
    "russell": "George Russell",
    "piastri": "Oscar Piastri",
    "alonso": "Fernando Alonso",
    "gasly": "Pierre Gasly",
    "ocon": "Esteban Ocon",
    "stroll": "Lance Stroll",
    "sainz": "Carlos Sainz Jr.",
    "albon": "Alexander Albon",
    "tsunoda": "Yuki Tsunoda",
    "hulkenberg": "Nico Hülkenberg",
    "lawson": "Liam Lawson",
    "antonelli": "Andrea Kimi Antonelli",
    "doohan": "Jack Doohan",
    "bearman": "Oliver Bearman",
    "hadjar": "Isack Hadjar", 
    "bortoleto": "Gabriel Bortoleto"
  };
  
  // Sprawdź, czy mamy mapowanie dla tego kierowcy
  if (driverMapping[apiDriverName.toLowerCase()]) {
    return driverMapping[apiDriverName.toLowerCase()];
  }
  
  // Jeśli nie ma mapowania, zwróć oryginalną nazwę
  return apiDriverName;
}

// ROUTES

// Strona główna - wybór kierowców
app.get('/', (req, res) => {
  res.render('index', { 
    drivers, 
    userSelections,
    driverPoints
  });
});

app.post('/select-drivers', (req, res) => {
  const { username, topDriver, midfieldDriver, rookie } = req.body;
  
  if (!username || !topDriver || !midfieldDriver || !rookie) {
    return res.status(400).json({ error: 'Wszystkie pola są wymagane' });
  }
  
  if (!drivers["Top Drivers"].includes(topDriver)) {
    return res.status(400).json({ error: 'Nieprawidłowy kierowca z grupy Top Drivers' });
  }
  
  if (!drivers["Midfield Drivers"].includes(midfieldDriver)) {
    return res.status(400).json({ error: 'Nieprawidłowy kierowca z grupy Midfield Drivers' });
  }
  
  if (!drivers["Rookies"].includes(rookie)) {
    return res.status(400).json({ error: 'Nieprawidłowy kierowca z grupy Rookies' });
  }
  
  userSelections[username] = {
    topDriver,
    midfieldDriver,
    rookie,
    totalPoints: 0
  };
  
  updateUserPoints(username);
  
  saveData();
  
  res.redirect('/leaderboard');
});

app.get('/add-race', (req, res) => {
  res.render('add-race-positions', { 
    drivers: Object.values(drivers).flat().sort(),
    driverPoints
  });
});

app.post('/save-race-positions', (req, res) => {
  const { raceName, raceDate, positions, fastestLap, raceType } = req.body;
  
  // Walidacja danych
  if (!raceName || !raceDate || !raceType) {
    return res.status(400).json({ error: 'Brakujące dane wyścigu' });
  }
  
  // Przetwórz pozycje na liczby
  const formattedPositions = {};
  if (positions) {
    Object.keys(positions).forEach(driver => {
      if (positions[driver] && !isNaN(parseInt(positions[driver]))) {
        formattedPositions[driver] = parseInt(positions[driver]);
      }
    });
  }
  
  // Tworzenie nowego wyścigu
  const newRace = {
    id: Date.now(), // Unikalny identyfikator
    name: raceName,
    date: raceDate,
    positions: formattedPositions,
    fastestLap: fastestLap || null,
    type: raceType // Dodajemy typ wyścigu
  };
  
  // Dodaj wyścig do historii
  races.push(newRace);
  
  // Oblicz punkty dla kierowców z tego wyścigu
  const racePoints = {};
  
  Object.keys(formattedPositions).forEach(driver => {
    const position = formattedPositions[driver];
    
    // Podstawowe punkty za pozycję (tylko dla podium)
    racePoints[driver] = position <= 3 ? pointsSystem[position] : 0;
    
    // Sprawdź, czy kierowca jest w punktowanej strefie (zależnie od typu wyścigu)
    const isInPointsZone = raceType === 'sprint' ? position <= 8 : position <= 10;
    
    // Dodatkowy punkt dla kierowców z kategorii "Midfield Drivers" za ukończenie w strefie punktowej
    if (isInPointsZone && drivers["Midfield Drivers"].includes(driver)) {
      racePoints[driver] += 1;
    }
    
    // Dodatkowe 2 punkty dla kierowców z kategorii "Rookies" za ukończenie w strefie punktowej
    if (isInPointsZone && drivers["Rookies"].includes(driver)) {
      racePoints[driver] += 2;
    }
    
    // Dodaj punkt za najszybsze okrążenie
    if (fastestLap === driver) {
      racePoints[driver] += 1;
    }
  });
  
  // Aktualizuj punkty w bazie danych
  Object.keys(racePoints).forEach(driver => {
    driverPoints[driver] = (driverPoints[driver] || 0) + racePoints[driver];
  });
  
  // Aktualizuj punkty dla wszystkich użytkowników
  Object.keys(userSelections).forEach(updateUserPoints);
  
  // Zapisz dane
  saveData();
  
  res.redirect('/race-results');
});

// Stara metoda zapisywania wyników wyścigu (zachowana dla kompatybilności)
app.post('/save-race', (req, res) => {
  const results = req.body;
  
  // Przetwarzamy punkty dla każdego kierowcy
  Object.keys(results).forEach(driver => {
    if (driver !== 'raceName') {
      const points = parseInt(results[driver]) || 0;
      driverPoints[driver] = (driverPoints[driver] || 0) + points;
    }
  });
  
  // Aktualizuj punkty dla wszystkich użytkowników
  Object.keys(userSelections).forEach(updateUserPoints);
  
  // Zapisz dane
  saveData();
  
  res.redirect('/leaderboard');
});

// Funkcja aktualizująca punkty użytkownika
function updateUserPoints(username) {
  const selection = userSelections[username];
  if (selection) {
    const topDriverPoints = driverPoints[selection.topDriver] || 0;
    const midfieldDriverPoints = driverPoints[selection.midfieldDriver] || 0;
    const rookiePoints = driverPoints[selection.rookie] || 0;
    
    selection.totalPoints = topDriverPoints + midfieldDriverPoints + rookiePoints;
  }
}

// Tabela wyników
app.get('/leaderboard', (req, res) => {
  // Sortuj użytkowników według punktów (od najwyższych)
  const sortedUsers = Object.entries(userSelections)
    .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
    .map(([username, data]) => ({
      username,
      ...data
    }));
  
  res.render('leaderboard', { 
    leaderboard: sortedUsers,
    driverPoints
  });
});

// Dodaj route do wyświetlania historii wyścigów
app.get('/race-results', (req, res) => {
  // Sortuj wyścigi od najnowszych do najstarszych
  const sortedRaces = [...races].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.render('race-results', { 
    races: sortedRaces,
    drivers,
    pointsSystem
  });
});

// Reset całej aplikacji (tylko do celów rozwojowych)
app.get('/reset', (req, res) => {
  // Resetuj punkty kierowców
  Object.values(drivers).flat().forEach(driver => {
    driverPoints[driver] = 0;
  });
  
  // Resetuj wybory użytkowników
  userSelections = {};
  
  // Resetuj historię wyścigów
  races = [];
  
  // Zapisz dane
  saveData();
  
  res.redirect('/');
});

// Dodaj route do wyświetlania kalendarza wyścigów
app.get('/race-calendar', async (req, res) => {
  // Pobieramy domyślnie dla aktualnego roku, ale można zmienić w zapytaniu
  const year = req.query.year || new Date().getFullYear();
  
  try {
    const races = await fetchRaceSchedule(year);
    
    res.render('race-calendar', { 
      races,
      year,
      // Dodaj listę lat do wyboru w formularzu
      years: Array.from({length: 6}, (_, i) => year - 3 + i)
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Nie udało się pobrać kalendarza wyścigów',
      error
    });
  }
});

// Dodaj route do pobierania wyników wyścigu
app.get('/fetch-race-results/:year/:round', async (req, res) => {
  const { year, round } = req.params;
  const raceType = req.query.type || 'grandprix'; // Dodaj parametr typu wyścigu
  
  try {
    const response = await axios.get(`https://ergast.com/api/f1/${year}/${round}/results.json`);
    
    if (response.data && response.data.MRData && response.data.MRData.RaceTable) {
      const raceData = response.data.MRData.RaceTable.Races[0];
      
      if (!raceData) {
        return res.status(404).json({ error: 'Nie znaleziono wyników dla tego wyścigu' });
      }
      
      const raceName = raceData.raceName;
      const results = raceData.Results;
      const raceDate = raceData.date;
      
      // Znajdź kierowcę z najszybszym okrążeniem
      let fastestLapDriverName = null;
      results.forEach(result => {
        if (result.FastestLap && result.FastestLap.rank === "1") {
          const driverName = `${result.Driver.givenName} ${result.Driver.familyName}`;
          // Sprawdź, czy kierowca jest w naszej bazie
          Object.values(drivers).flat().forEach(driver => {
            if (driver === driverName) {
              fastestLapDriverName = driverName;
            }
          });
        }
      });
      
      // Utwórz mapę pozycji kierowców
      const positions = {};
      results.forEach(result => {
        const driverName = `${result.Driver.givenName} ${result.Driver.familyName}`;
        const position = parseInt(result.position);
        
        // Sprawdź, czy kierowca jest w naszej bazie
        Object.values(drivers).flat().forEach(driver => {
          if (driver === driverName) {
            positions[driverName] = position;
          }
        });
      });
      
      // Tworzenie nowego wyścigu
      const newRace = {
        id: Date.now(), // Unikalny identyfikator
        name: raceName,
        date: raceDate,
        positions: positions,
        fastestLap: fastestLapDriverName,
        type: raceType // Dodajemy typ wyścigu
      };
      
      // Dodaj wyścig do historii
      races.push(newRace);
      
      // Oblicz punkty dla kierowców z tego wyścigu
      const racePoints = {};
      
      Object.keys(positions).forEach(driver => {
        const position = positions[driver];
        
        // Podstawowe punkty za pozycję (tylko dla podium)
        racePoints[driver] = position <= 3 ? pointsSystem[position] : 0;
        
        // Sprawdź, czy kierowca jest w strefie punktowej (zależnie od typu wyścigu)
        const isInPointsZone = raceType === 'sprint' ? position <= 8 : position <= 10;
        
        // Dodatkowy punkt dla kierowców z kategorii "Midfield Drivers" za ukończenie w strefie punktowej
        if (isInPointsZone && drivers["Midfield Drivers"].includes(driver)) {
          racePoints[driver] += 1;
        }
        
        // Dodatkowe 2 punkty dla kierowców z kategorii "Rookies" za ukończenie w strefie punktowej
        if (isInPointsZone && drivers["Rookies"].includes(driver)) {
          racePoints[driver] += 2;
        }
        
        // Dodaj punkt za najszybsze okrążenie
        if (fastestLapDriverName === driver) {
          racePoints[driver] += 1;
        }
      });
      
      // Aktualizuj punkty w bazie danych
      Object.keys(racePoints).forEach(driver => {
        driverPoints[driver] = (driverPoints[driver] || 0) + racePoints[driver];
      });
      
      // Aktualizuj punkty użytkowników
      Object.keys(userSelections).forEach(updateUserPoints);
      
      // Zapisz dane
      saveData();
      
      res.json({ 
        success: true, 
        message: `Załadowano wyniki ${raceType === 'sprint' ? 'sprintu' : 'wyścigu'}: ${raceName} z nowym systemem punktacji`,
        racePoints
      });
    } else {
      res.status(404).json({ error: 'Nie znaleziono wyników dla tego wyścigu' });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Nie udało się pobrać wyników wyścigu',
      details: error.message
    });
  }
});

// Dodaj route do pobierania listy kierowców z API (może być przydatne do synchronizacji nazwisk)
app.get('/drivers/:season', async (req, res) => {
  const { season } = req.params;
  
  try {
    const response = await axios.get(`https://ergast.com/api/f1/${season}/drivers.json`);
    
    if (response.data && response.data.MRData && response.data.MRData.DriverTable) {
      const driversFromApi = response.data.MRData.DriverTable.Drivers.map(driver => ({
        id: driver.driverId,
        code: driver.code,
        number: driver.permanentNumber,
        givenName: driver.givenName,
        familyName: driver.familyName,
        nationality: driver.nationality
      }));
      
      res.json({ 
        success: true,
        drivers: driversFromApi 
      });
    } else {
      res.status(404).json({ error: 'Nie znaleziono kierowców dla tego sezonu' });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Nie udało się pobrać listy kierowców',
      details: error.message
    });
  }
});

// Konfiguracja HTTPS
try {
  const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/f1insider.security-eng.pl/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/f1insider.security-eng.pl/fullchain.pem')
  };

  // Uruchom serwer HTTPS
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log(`Serwer HTTPS uruchomiony na porcie ${HTTPS_PORT}`);
  });
} catch (err) {
  console.log('Nie udało się uruchomić serwera HTTPS. Uruchamianie tylko HTTP.');
}

// Uruchom serwer HTTP
app.listen(PORT, () => {
  console.log(`Serwer HTTP uruchomiony na porcie ${PORT}`);
});