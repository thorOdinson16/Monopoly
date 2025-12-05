# 🎲 Monopoly – Online Multiplayer Board Game

A web-based Monopoly-style board game with multiple board layouts (2–6 players), a React front-end, and a Node.js + MongoDB backend for user authentication.
The game logic is implemented through interactive HTML/JavaScript boards embedded inside the React app.

---

## 🚀 Features

### 🎮 Game Features

* Playable Monopoly-style board game directly in the browser
* Multiple board variants:

  * 2-player
  * 3-player
  * 4-player
  * 5-player
  * 6-player
* Complete basic rules: dice rolls, tile movement, property buying, rent, Chance/Community Chest, jail, and more
* Interactive UI with modals, prompts, and turn-based logic
* Game rendered through static HTML/JS board files

### 👤 User System

* User registration & login
* Profile page
* Leaderboard page
* Add Friend page (UI only)
* Simple session flow

### ⚙️ Technology Stack

**Frontend:** React (Create React App), HTML5 canvas, vanilla JS
**Backend:** Node.js, Express, MongoDB (Mongoose)
**UI:** React Router, CSS
**Communication:** Axios

---

## 📁 Project Structure

```
root
│
├── Client/                     # React Frontend
│   ├── public/
│   │   ├── MonopolyM.html     # Main board
│   │   ├── MonopolyM_2.html   # 2-player version
│   │   ├── MonopolyM_3.html   # 3-player version
│   │   ├── MonopolyM_5.html   # 5-player version
│   │   ├── MonopolyM_6.html   # 6-player version
│   │   ├── Game.js            # Core JS logic used by all boards
│   │   └── style.css
│   │
│   ├── src/
│   │   ├── App.js             # Routing
│   │   ├── Login.js
│   │   ├── Signup.js
│   │   ├── Home.js
│   │   ├── players/           # Components embedding HTML boards
│   │   │   ├── Game.js
│   │   │   ├── Game2.js
│   │   │   ├── Game3.js
│   │   │   ├── Game5.js
│   │   │   └── Game6.js
│   │   ├── Profile.js
│   │   ├── LeaderBoard.js
│   │   └── Rulebook.js
│   │
│   └── package.json
│
└── server/                    # Backend
    ├── index.js               # Express server
    ├── models/
    │   └── employee.js        # User schema (name, email, password)
    └── package.json
```

---

## 🧩 How It Works

### Game Engine

The actual game logic (dice, movement, money, tiles, properties, etc.) is managed in **public/MonopolyM*.html** files using JavaScript.

React does **not** run the game — it simply embeds the board via an `<iframe>`.

### Frontend

React handles:

* Routing
* UI pages (Login, Signup, Home, Leaderboard, etc.)
* Choosing which game board to open
* Displaying profile & leaderboard sections

### Backend

Express + MongoDB handles:

* POST `/register`
* POST `/login`
* Database: `mongodb://localhost:27017/employee`

Passwords are stored in plaintext → **not suitable for production**.

---

## 🛠️ Installation & Setup

### 1️⃣ Start MongoDB

Local MongoDB must be running:

```bash
mongod
```

### 2️⃣ Run Backend

```
cd server
npm install
npm start
```

Server runs at **[http://localhost:3001](http://localhost:3001)**

### 3️⃣ Run Frontend

```
cd Client
npm install
npm start
```

App runs at **[http://localhost:3000](http://localhost:3000)**

---

## 🌐 Available Routes (Frontend)

| Route          | Description                         |
| -------------- | ----------------------------------- |
| `/register`    | Sign up                             |
| `/login`       | Log in                              |
| `/home`        | Dashboard to choose board           |
| `/game`        | Default game                        |
| `/game2`       | 2-player board                      |
| `/game3`       | 3-player board                      |
| `/game5`       | 5-player board                      |
| `/game6`       | 6-player board                      |
| `/leaderboard` | Leaderboard page                    |
| `/profile`     | Profile page                        |
| `/rulebook`    | How-to-play guide                   |
| `/addfriend`   | Friend addition UI (non-persistent) |

---

## ⚠️ Important Notes

* Passwords are handled and stored in plaintext.
  Replace with `bcrypt` + JWT before any production use.
* No input validation or sanitization — should be added.
* Game logic is entirely in static HTML/JS — React only embeds it.
* Leaderboard and friend lists are not persisted in database.

---
