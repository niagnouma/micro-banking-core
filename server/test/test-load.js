// import http from "k6/http";
// import { sleep, check } from "k6";

// export const options = {
//   stages: [
//     { duration: "20s", target: 2 },
//     { duration: "20s", target: 5 },
//     { duration: "20s", target: 10 },
//     { duration: "20s", target: 0 },
//   ],
// };

// const BASE_URL = "http://localhost:3000";

// export default function () {
//   const res = http.get(`${BASE_URL}/api/v1`);

//   check(res, {
//     "Status 200": (r) => r.status === 200,
//   });

//   sleep(1);
// }
// import http from "k6/http";
// import { sleep } from "k6";

// export default function () {
//   const res = http.get("http://localhost:3000/api/v1");

//   console.log(`Status : ${res.status}`);

//   sleep(1);
// }
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "20s", target: 2 },
    { duration: "20s", target: 5 },
    { duration: "20s", target: 10 },
    { duration: "20s", target: 0 },
  ],
};

const BASE_URL = "http://localhost:3000";

export default function () {
  // 1. Connexion
  const loginPayload = JSON.stringify({
    username: "admin", // Remplace par ton vrai nom d'utilisateur
    password: "azerty6784", // Remplace par ton vrai mot de passe
  });

  const loginParams = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const loginRes = http.post(
    `${BASE_URL}/api/v1/admin/login`,
    loginPayload,
    loginParams,
  );

  check(loginRes, {
    "Login réussi": (r) => r.status === 200,
  });

  if (loginRes.status !== 200) {
    return;
  }

  // 2. Récupération du JWT
  const token = loginRes.json("data.accessToken");

  const authParams = {
    headers: {
      "x-auth-token": token,
    },
  };

  // 3. Consultation des clients
  const clientsRes = http.get(`${BASE_URL}/api/v1/clients`, authParams);

  check(clientsRes, {
    "Clients récupérés": (r) => r.status === 200,
  });

  // 4. Consultation des transactions
  const transactionsRes = http.get(
    `${BASE_URL}/api/v1/transactions`,
    authParams,
  );

  check(transactionsRes, {
    "Transactions récupérées": (r) => r.status === 200,
  });

  // 5. Pause
  sleep(1);
}
