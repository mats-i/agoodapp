// src/lib/auth.js
// Hanterar auth och användarhantering för AGoodApp

// Placeholder: enkel hantering av currentUser för demo
let currentUser = 'mats'; // För demo, senare från inloggning

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}
