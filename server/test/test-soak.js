import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10, // 10 utilisateurs virtuels simultanés
  duration: "45m", // Test d'endurance de 45 minutes
};

const BASE_URL = "http://localhost:3000";

export default function () {
  // Connexion
  const loginPayload = JSON.stringify({
    username: "admin",
    password: "azerty6784", // Remplace par ton mot de passe
  });

  const loginRes = http.post(`${BASE_URL}/api/v1/admin/login`, loginPayload, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  check(loginRes, {
    "Login réussi": (r) => r.status === 200,
  });

  if (loginRes.status !== 200) {
    sleep(1);
    return;
  }

  const token = loginRes.json("data.accessToken");

  const params = {
    headers: {
      "x-auth-token": token,
    },
  };

  // Consultation des clients
  const clients = http.get(`${BASE_URL}/api/v1/clients`, params);

  check(clients, {
    "Clients OK": (r) => r.status === 200,
  });

  // Consultation des transactions
  const transactions = http.get(`${BASE_URL}/api/v1/transactions`, params);

  check(transactions, {
    "Transactions OK": (r) => r.status === 200,
  });

  // Pause avant de recommencer le scénario
  sleep(1);
}
