# F1 Fantasy - Formula 1 Team Manager

## Overview

F1 Fantasy is a web application that lets Formula 1 fans create their own fantasy teams by selecting drivers from different categories and tracking their performance based on real F1 race results. Built with Node.js and Express, this application features a modern dark-themed interface and custom scoring system.

## Features

- **Driver Selection System**: Choose one driver from each of three categories:
  - Top Drivers (championship contenders)
  - Midfield Drivers (established midfield competitors)
  - Rookies (new and upcoming talents)

- **Custom Scoring System**:
  - Podium positions (1-3): 3-2-1 points
  - Midfield drivers in top 10: +1 bonus point
  - Rookies in top 10: +2 bonus points
  - Fastest lap: +1 point

- **Race Management**:
  - Manual race results entry by position
  - Automated results fetching from Ergast F1 API
  - Race calendar with upcoming and past races
  - Detailed race history with points breakdown

- **Leaderboards**:
  - User rankings based on total points
  - Driver performance tracking

- **Modern UI**:
  - Dark-themed interface
  - Responsive design for all devices
  - Interactive race cards and result tables

## Technology Stack

- **Backend**: Node.js, Express
- **Frontend**: EJS templates, Bootstrap 5, Custom CSS
- **Data Storage**: JSON file-based persistence
- **API Integration**: Ergast Formula 1 API

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Patrick2402/f1-fantasy.git
cd f1-fantasy
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

4. Access the application at http://localhost:3000

## Usage

### Setting Up Your Team
1. Visit the homepage and enter your username
2. Select one driver from each category
3. Submit your selection to enter the competition

### Following Races
1. View the race calendar to see upcoming events
2. After each race, either:
   - Manually add race results by entering driver positions
   - Fetch official results automatically from the Ergast API

### Tracking Performance
1. Check the leaderboard to see your ranking
2. View race history to analyze driver performance
3. Monitor your points accumulation throughout the season

## Project Structure

```
f1-fantasy/
├── public/
│   └── css/
│       └── style.css
├── views/
│   ├── partials/
│   ├── index.ejs
│   ├── leaderboard.ejs
│   ├── add-race-positions.ejs
│   ├── race-results.ejs
│   └── race-calendar.ejs
├── data/
├── app.js
└── package.json
```

## API Integration

The application connects to the Ergast F1 API to:
- Fetch race calendars for current and future seasons
- Retrieve official race results including positions and fastest laps
- Access driver information and statistics

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

---

*This is an unofficial fan project and is not affiliated with, endorsed, sponsored, or approved by Formula One or any affiliated companies.*

