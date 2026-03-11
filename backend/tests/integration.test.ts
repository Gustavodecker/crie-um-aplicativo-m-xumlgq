import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let consultantId: string;
  let userId: string;
  let userEmail: string;
  let babyId: string;
  let babyToken: string;
  let contractId: string;
  let routineId: string;
  let napId: string;
  let nightSleepId: string;
  let nightWakingId: string;
  let orientationId: string;
  let sleepWindowId: string;

  // ===== Auth & Consultant Profile =====

  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    userId = user.id;
    userEmail = user.email;
    expect(authToken).toBeDefined();
    expect(userId).toBeDefined();
  });

  test("Initialize consultant profile", async () => {
    const res = await authenticatedApi("/api/init/consultant", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. Test Consultant",
        photo: null,
        logo: null,
        primaryColor: "#FF5733",
        secondaryColor: "#33FF57",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    consultantId = data.id;
    expect(data.name).toBe("Dr. Test Consultant");
    expect(data.userId).toBe(userId);
    expect(data.primaryColor).toBe("#FF5733");
  });

  test("Get consultant profile", async () => {
    const res = await authenticatedApi("/api/consultant/profile", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(consultantId);
    expect(data.name).toBe("Dr. Test Consultant");
  });

  test("Update consultant profile", async () => {
    const res = await authenticatedApi("/api/consultant/profile", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. Updated Consultant",
        primaryColor: "#0000FF",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.name).toBe("Dr. Updated Consultant");
    expect(data.primaryColor).toBe("#0000FF");
  });

  test("Init consultant without required name field returns 400", async () => {
    const res = await authenticatedApi("/api/init/consultant", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photo: null,
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get consultant profile without auth returns 401", async () => {
    const res = await api("/api/consultant/profile");
    await expectStatus(res, 401);
  });

  test("Update consultant profile without auth returns 401", async () => {
    const res = await api("/api/consultant/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Init consultant without auth returns 401", async () => {
    const res = await api("/api/init/consultant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get consultant profile for new user without initialization returns 404", async () => {
    const { token: newToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/consultant/profile", newToken);
    await expectStatus(res, 404);
  });

  // ===== Create Consultant Profile Endpoint =====

  test("Create consultant profile with create-profile endpoint", async () => {
    const { token: consultantToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/consultants/create-profile", consultantToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. New Consultant",
        professionalTitle: "Sleep Specialist",
        description: "Expert in infant sleep coaching",
        primaryColor: "#FF9800",
        secondaryColor: "#FFC107",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.name).toBe("Dr. New Consultant");
    expect(data.professionalTitle).toBe("Sleep Specialist");
    expect(data.description).toBe("Expert in infant sleep coaching");
    expect(data.userId).toBeDefined();
  });

  test("Create consultant profile with defaults for colors", async () => {
    const { token: consultantToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/consultants/create-profile", consultantToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. Default Colors",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.name).toBe("Dr. Default Colors");
    expect(data.primaryColor).toBe("#007AFF"); // default
    expect(data.secondaryColor).toBe("#5AC8FA"); // default
  });

  test("Create consultant profile without required name returns 400", async () => {
    const { token: consultantToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/consultants/create-profile", consultantToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        professionalTitle: "Coach",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create consultant profile without auth returns 401", async () => {
    const res = await api("/api/consultants/create-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthorized",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create consultant profile with duplicate user returns 409", async () => {
    const { token: consultantToken } = await signUpTestUser();
    // Create first profile
    await authenticatedApi("/api/consultants/create-profile", consultantToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. First Profile",
      }),
    });
    // Try to create second profile for same user
    const res = await authenticatedApi("/api/consultants/create-profile", consultantToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. Second Profile",
      }),
    });
    await expectStatus(res, 409);
  });

  // ===== Babies =====

  test("Create baby", async () => {
    const res = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby Test",
        birthDate: "2024-01-15",
        motherName: "Mother Test",
        motherPhone: "+1234567890",
        objectives: "Sleep training",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    babyId = data.id;
    babyToken = data.token;
    expect(data.name).toBe("Baby Test");
    expect(data.motherName).toBe("Mother Test");
    expect(data.consultantId).toBe(consultantId);
    expect(data.token).toBeDefined();
  });

  test("Create baby via consultant endpoint", async () => {
    const res = await authenticatedApi("/api/consultant/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby via Consultant",
        birthDate: "2024-02-15",
        motherName: "Mother via Consultant",
        motherPhone: "+0987654321",
        objectives: "Sleep training via consultant",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.name).toBe("Baby via Consultant");
    expect(data.consultantId).toBe(consultantId);
    expect(data.token).toBeDefined();
  });

  test("Get baby by ID", async () => {
    const res = await authenticatedApi(`/api/babies/${babyId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(babyId);
    expect(data.name).toBe("Baby Test");
    expect(data.ageMonths).toBeGreaterThanOrEqual(0);
    expect(data.ageDays).toBeGreaterThanOrEqual(0);
  });

  test("Update baby", async () => {
    const res = await authenticatedApi(`/api/babies/${babyId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby Updated",
        objectives: "Better sleep routine",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.name).toBe("Baby Updated");
    expect(data.objectives).toBe("Better sleep routine");
  });

  test("Archive baby", async () => {
    const res = await authenticatedApi(`/api/babies/${babyId}/archive`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        archived: true,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.archived).toBe(true);
  });

  test("Unarchive baby", async () => {
    const res = await authenticatedApi(`/api/babies/${babyId}/archive`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        archived: false,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.archived).toBe(false);
  });

  test("Archive baby with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/babies/00000000-0000-0000-0000-000000000000/archive",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archived: true,
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Archive baby with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/babies/invalid-uuid/archive",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archived: true,
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Get baby with invalid UUID returns 400", async () => {
    const res = await authenticatedApi("/api/babies/invalid-uuid", authToken);
    await expectStatus(res, 400);
  });

  test("Get baby with nonexistent UUID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/babies/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Update baby with nonexistent UUID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/babies/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nonexistent Baby",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update baby with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/babies/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Delete baby", async () => {
    // Create a baby specifically for deletion
    const createRes = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby to Delete",
        birthDate: "2024-03-15",
        motherName: "Mother Test",
        motherPhone: "+1234567890",
      }),
    });
    const babyToDelete = await createRes.json();

    const res = await authenticatedApi(`/api/babies/${babyToDelete.id}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);

    // Verify baby is deleted
    const verifyRes = await authenticatedApi(`/api/babies/${babyToDelete.id}`, authToken);
    await expectStatus(verifyRes, 404);
  });

  test("Delete baby with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/babies/00000000-0000-0000-0000-000000000000",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 404);
  });

  test("Delete baby with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/babies/invalid-uuid",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 400);
  });

  test("Create baby without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Incomplete Baby",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create baby via consultant endpoint without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/consultant/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Incomplete Baby",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create baby without auth returns 401", async () => {
    const res = await api("/api/babies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby",
        birthDate: "2024-01-15",
        motherName: "Mother",
        motherPhone: "+1234567890",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create baby via consultant endpoint without auth returns 401", async () => {
    const res = await api("/api/consultant/babies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby",
        birthDate: "2024-01-15",
        motherName: "Mother",
        motherPhone: "+1234567890",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get baby without auth returns 401", async () => {
    const res = await api(`/api/babies/${babyId}`);
    await expectStatus(res, 401);
  });

  test("Update baby without auth returns 401", async () => {
    const res = await api(`/api/babies/${babyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Delete baby without auth returns 401", async () => {
    const res = await api(`/api/babies/${babyId}`, {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Get consultant babies list", async () => {
    const res = await authenticatedApi("/api/consultant/babies", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const baby = data.find((b: any) => b.id === babyId);
    expect(baby).toBeDefined();
    expect(baby.name).toBe("Baby Updated");
  });

  test("Get consultant babies with includeArchived parameter", async () => {
    const res = await authenticatedApi("/api/consultant/babies?includeArchived=true", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get consultant babies without auth returns 401", async () => {
    const res = await api("/api/consultant/babies");
    await expectStatus(res, 401);
  });

  // ===== Contracts =====

  test("Create contract", async () => {
    const res = await authenticatedApi("/api/contracts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        startDate: "2026-02-22",
        durationDays: 30,
        status: "active",
        contractPdfUrl: null,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    contractId = data.id;
    expect(data.babyId).toBe(babyId);
    expect(data.status).toBe("active");
    expect(data.durationDays).toBe(30);
  });

  test("Update contract", async () => {
    const res = await authenticatedApi(
      `/api/contracts/${contractId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paused",
          durationDays: 45,
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.status).toBe("paused");
    expect(data.durationDays).toBe(45);
  });

  test("Get active contract for baby", async () => {
    // Update contract back to active
    await authenticatedApi(
      `/api/contracts/${contractId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "active",
        }),
      }
    );

    const res = await authenticatedApi(
      `/api/contracts/baby/${babyId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).not.toBeNull();
    expect(data.babyId).toBe(babyId);
  });

  test("Get active contract for baby with no contract returns 200 with null", async () => {
    const newBabyRes = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby No Contract",
        birthDate: "2024-06-15",
        motherName: "Mother Test",
        motherPhone: "+1234567890",
      }),
    });
    const newBaby = await newBabyRes.json();
    const res = await authenticatedApi(
      `/api/contracts/baby/${newBaby.id}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toBeNull();
  });

  test("Create contract with nonexistent baby returns 404", async () => {
    const res = await authenticatedApi("/api/contracts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: "00000000-0000-0000-0000-000000000000",
        startDate: "2024-02-01",
        durationDays: 30,
        status: "active",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Update contract with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/contracts/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update contract with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/contracts/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Create contract without auth returns 401", async () => {
    const res = await api("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        startDate: "2026-02-22",
        durationDays: 30,
        status: "active",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update contract without auth returns 401", async () => {
    const res = await api(`/api/contracts/${contractId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "paused",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create contract without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/contracts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create contract with invalid baby UUID returns 400", async () => {
    const res = await authenticatedApi("/api/contracts", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: "invalid-uuid",
        startDate: "2026-02-22",
        durationDays: 30,
        status: "active",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get contract for baby with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/contracts/baby/invalid-uuid",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Get contract for baby without auth returns 401", async () => {
    const res = await api(`/api/contracts/baby/${babyId}`);
    await expectStatus(res, 401);
  });

  // ===== Routines =====

  test("Create routine", async () => {
    const res = await authenticatedApi("/api/routines", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        date: "2026-02-22",
        wakeUpTime: "07:00",
        motherObservations: "Baby slept well",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    routineId = data.id;
    expect(data.babyId).toBe(babyId);
    expect(data.wakeUpTime).toBe("07:00");
  });

  test("Get routine by ID", async () => {
    const res = await authenticatedApi(`/api/routines/${routineId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(routineId);
    expect(data.wakeUpTime).toBe("07:00");
    expect(Array.isArray(data.naps)).toBe(true);
  });

  test("Update routine", async () => {
    const res = await authenticatedApi(
      `/api/routines/${routineId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpTime: "07:30",
          motherObservations: "Updated observation",
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.wakeUpTime).toBe("07:30");
    expect(data.motherObservations).toBe("Updated observation");
  });

  test("Get all routines for baby", async () => {
    const res = await authenticatedApi(
      `/api/routines/baby/${babyId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const routine = data.find((r: any) => r.id === routineId);
    expect(routine).toBeDefined();
  });

  test("Get routine with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/routines/invalid-uuid",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Get routine with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/routines/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Update routine with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/routines/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpTime: "08:00",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update routine with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/routines/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpTime: "08:00",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Create routine with nonexistent baby returns 404", async () => {
    const res = await authenticatedApi("/api/routines", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: "00000000-0000-0000-0000-000000000000",
        date: "2026-02-23",
        wakeUpTime: "07:00",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Create routine without auth returns 401", async () => {
    const res = await api("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        date: "2026-02-23",
        wakeUpTime: "07:00",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update routine without auth returns 401", async () => {
    const res = await api(`/api/routines/${routineId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeUpTime: "08:00",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get routines for baby without auth returns 401", async () => {
    const res = await api(`/api/routines/baby/${babyId}`);
    await expectStatus(res, 401);
  });

  test("Get routines for baby with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/routines/baby/invalid-uuid",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Create routine without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/routines", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        date: "2026-02-23",
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Naps =====

  test("Create nap", async () => {
    const res = await authenticatedApi("/api/naps", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routineId: routineId,
        napNumber: 1,
        startTryTime: "09:00",
        fellAsleepTime: "09:15",
        wakeUpTime: "10:00",
        sleepMethod: "rocking",
        environment: "dark room",
        wakeUpMood: "happy",
        observations: "First nap of day",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    napId = data.id;
    expect(data.routineId).toBe(routineId);
    expect(data.napNumber).toBe(1);
  });

  test("Update nap", async () => {
    const res = await authenticatedApi(`/api/naps/${napId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeUpMood: "tired",
        observations: "Updated nap observation",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.wakeUpMood).toBe("tired");
  });

  test("Delete nap", async () => {
    const res = await authenticatedApi(`/api/naps/${napId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Delete nonexistent nap returns 404", async () => {
    const res = await authenticatedApi(
      "/api/naps/00000000-0000-0000-0000-000000000000",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 404);
  });

  test("Delete nap with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/naps/invalid-uuid",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 400);
  });

  test("Create nap with nonexistent routine returns 404", async () => {
    const res = await authenticatedApi("/api/naps", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routineId: "00000000-0000-0000-0000-000000000000",
        napNumber: 1,
        startTryTime: "09:00",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Create nap without auth returns 401", async () => {
    const res = await api("/api/naps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routineId: routineId,
        napNumber: 1,
        startTryTime: "09:00",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update nap with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/naps/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpMood: "fussy",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update nap with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/naps/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpMood: "fussy",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Update nap without auth returns 401", async () => {
    const res = await api(`/api/naps/${napId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeUpMood: "happy",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Delete nap without auth returns 401", async () => {
    const res = await api(`/api/naps/${napId}`, {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Create nap without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/naps", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routineId: routineId,
        napNumber: 1,
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Night Sleep =====

  test("Create night sleep", async () => {
    const res = await authenticatedApi("/api/night-sleep", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routineId: routineId,
        startTryTime: "20:30",
        fellAsleepTime: "20:45",
        finalWakeTime: "07:00",
        sleepMethod: "independent",
        environment: "crib",
        wakeUpMood: "alert",
        observations: "Good night sleep",
      }),
    });
    // Returns 200 because nightSleep is auto-created with routine, so POST updates it
    await expectStatus(res, 200, 201);
    const data = await res.json();
    nightSleepId = data.id;
    expect(data.routineId).toBe(routineId);
  });

  test("Update night sleep", async () => {
    const res = await authenticatedApi(
      `/api/night-sleep/${nightSleepId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpMood: "fussy",
          observations: "Updated sleep observation",
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.wakeUpMood).toBe("fussy");
  });

  test("Update night sleep with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/night-sleep/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpMood: "happy",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update night sleep with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/night-sleep/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wakeUpMood: "happy",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Create night sleep with nonexistent routine returns 404", async () => {
    const res = await authenticatedApi("/api/night-sleep", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routineId: "00000000-0000-0000-0000-000000000000",
        startTryTime: "20:30",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Create night sleep without auth returns 401", async () => {
    const res = await api("/api/night-sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routineId: routineId,
        startTryTime: "20:30",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update night sleep without auth returns 401", async () => {
    const res = await api(`/api/night-sleep/${nightSleepId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeUpMood: "happy",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create night sleep without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/night-sleep", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Missing routineId - should fail
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create night sleep without required routineId returns 400", async () => {
    const res = await authenticatedApi("/api/night-sleep", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTryTime: "20:30",
        fellAsleepTime: "20:45",
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Night Wakings =====

  test("Create night waking", async () => {
    const res = await authenticatedApi("/api/night-wakings", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nightSleepId: nightSleepId,
        startTime: "23:30",
        endTime: "23:45",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    nightWakingId = data.id;
    expect(data.nightSleepId).toBe(nightSleepId);
  });

  test("Update night waking", async () => {
    const res = await authenticatedApi(
      `/api/night-wakings/${nightWakingId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: "01:00",
          endTime: "01:15",
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.startTime).toBe("01:00");
    expect(data.endTime).toBe("01:15");
  });

  test("Update night waking with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/night-wakings/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: "01:00",
          endTime: "01:15",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update night waking with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/night-wakings/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: "01:00",
          endTime: "01:15",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Delete night waking", async () => {
    const res = await authenticatedApi(
      `/api/night-wakings/${nightWakingId}`,
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 204);
  });

  test("Delete nonexistent night waking returns 404", async () => {
    const res = await authenticatedApi(
      "/api/night-wakings/00000000-0000-0000-0000-000000000000",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 404);
  });

  test("Delete night waking with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/night-wakings/invalid-uuid",
      authToken,
      { method: "DELETE" }
    );
    await expectStatus(res, 400);
  });

  test("Create night waking with nonexistent sleep record returns 404", async () => {
    const res = await authenticatedApi("/api/night-wakings", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nightSleepId: "00000000-0000-0000-0000-000000000000",
        startTime: "01:00",
        endTime: "01:15",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Create night waking without auth returns 401", async () => {
    const res = await api("/api/night-wakings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nightSleepId: nightSleepId,
        startTime: "23:00",
        endTime: "23:15",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update night waking without auth returns 401", async () => {
    const res = await api(`/api/night-wakings/${nightWakingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: "01:00",
        endTime: "01:15",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Delete night waking without auth returns 401", async () => {
    const res = await api(`/api/night-wakings/${nightWakingId}`, {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Create night waking without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/night-wakings", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nightSleepId: nightSleepId,
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Orientations =====

  test("Create orientation", async () => {
    const res = await authenticatedApi("/api/orientations", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        date: "2026-02-22",
        orientationText: "Continue sleep training approach",
        results: "Positive progress observed",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    orientationId = data.id;
    expect(data.babyId).toBe(babyId);
    expect(data.orientationText).toBe("Continue sleep training approach");
  });

  test("Update orientation", async () => {
    const res = await authenticatedApi(
      `/api/orientations/${orientationId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orientationText: "Updated orientation text",
          results: "Excellent progress",
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.orientationText).toBe("Updated orientation text");
    expect(data.results).toBe("Excellent progress");
  });

  test("Get all orientations for baby", async () => {
    const res = await authenticatedApi(
      `/api/orientations/baby/${babyId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const orientation = data.find((o: any) => o.id === orientationId);
    expect(orientation).toBeDefined();
  });

  test("Update orientation with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/orientations/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orientationText: "test",
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update orientation with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/orientations/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orientationText: "test",
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Create orientation with nonexistent baby returns 404", async () => {
    const res = await authenticatedApi("/api/orientations", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: "00000000-0000-0000-0000-000000000000",
        date: "2024-02-20",
        orientationText: "Test",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Create orientation without auth returns 401", async () => {
    const res = await api("/api/orientations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        date: "2026-02-22",
        orientationText: "Test orientation",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update orientation without auth returns 401", async () => {
    const res = await api(`/api/orientations/${orientationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orientationText: "test",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get orientations for baby without auth returns 401", async () => {
    const res = await api(`/api/orientations/baby/${babyId}`);
    await expectStatus(res, 401);
  });

  test("Get orientations for baby with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/orientations/baby/invalid-uuid",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Create orientation without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/orientations", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        babyId: babyId,
        date: "2026-02-22",
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Sleep Windows =====

  test("Create sleep window", async () => {
    const res = await authenticatedApi("/api/sleep-windows", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageMonthsMin: 0,
        ageMonthsMax: 3,
        windowMinutes: 45,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    sleepWindowId = data.id;
    expect(data.consultantId).toBe(consultantId);
    expect(data.windowMinutes).toBe(45);
  });

  test("Get all sleep windows", async () => {
    const res = await authenticatedApi("/api/sleep-windows", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const window = data.find((w: any) => w.id === sleepWindowId);
    expect(window).toBeDefined();
  });

  test("Update sleep window", async () => {
    const res = await authenticatedApi(
      `/api/sleep-windows/${sleepWindowId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          windowMinutes: 60,
        }),
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.windowMinutes).toBe(60);
  });

  test("Update sleep window with nonexistent ID returns 404", async () => {
    const res = await authenticatedApi(
      "/api/sleep-windows/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          windowMinutes: 30,
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update sleep window with invalid UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/sleep-windows/invalid-uuid",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          windowMinutes: 30,
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Create sleep window without auth returns 401", async () => {
    const res = await api("/api/sleep-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageMonthsMin: 3,
        ageMonthsMax: 6,
        windowMinutes: 60,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update sleep window without auth returns 401", async () => {
    const res = await api(`/api/sleep-windows/${sleepWindowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        windowMinutes: 30,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get sleep windows without auth returns 401", async () => {
    const res = await api("/api/sleep-windows");
    await expectStatus(res, 401);
  });

  test("Create sleep window without required fields returns 400", async () => {
    const res = await authenticatedApi("/api/sleep-windows", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageMonthsMin: 3,
      }),
    });
    await expectStatus(res, 400);
  });

  // ===== Reports =====

  test("Get sleep report for baby", async () => {
    const res = await authenticatedApi(
      `/api/reports/baby/${babyId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.babyId).toBe(babyId);
    expect(typeof data.totalNaps).toBe("number");
    expect(typeof data.totalNapDuration).toBe("number");
    expect(Array.isArray(data.dailyEvolution)).toBe(true);
  });

  test("Get sleep report with date range", async () => {
    const res = await authenticatedApi(
      `/api/reports/baby/${babyId}?startDate=2026-02-01&endDate=2026-02-28`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.babyId).toBe(babyId);
    expect(data.startDate).toBe("2026-02-01");
    expect(data.endDate).toBe("2026-02-28");
  });

  test("Get sleep report without auth returns 401", async () => {
    const res = await api(`/api/reports/baby/${babyId}`);
    await expectStatus(res, 401);
  });

  test("Get sleep report with invalid baby UUID returns 400", async () => {
    const res = await authenticatedApi(
      `/api/reports/baby/invalid-uuid`,
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Get sleep report with nonexistent baby UUID returns 200", async () => {
    const res = await authenticatedApi(
      `/api/reports/baby/00000000-0000-0000-0000-000000000000`,
      authToken
    );
    // Reports endpoint may return 200 with empty data for nonexistent baby
    await expectStatus(res, 200);
  });

  // ===== File Upload =====

  test("Upload contract PDF", async () => {
    const form = new FormData();
    const file = createTestFile("test-contract.pdf", "PDF content");
    form.append("file", file);
    const res = await authenticatedApi(
      "/api/upload/contract",
      authToken,
      {
        method: "POST",
        body: form,
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.url).toBe("string");
    expect(typeof data.filename).toBe("string");
  });

  test("Upload contract without auth returns 401", async () => {
    const form = new FormData();
    const file = createTestFile("test-contract.pdf", "PDF content");
    form.append("file", file);
    const res = await api("/api/upload/contract", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  test("Upload contract without file returns 400", async () => {
    const form = new FormData();
    const res = await authenticatedApi(
      "/api/upload/contract",
      authToken,
      {
        method: "POST",
        body: form,
      }
    );
    await expectStatus(res, 400);
  });

  test("Upload profile photo", async () => {
    const form = new FormData();
    const file = createTestFile("profile.jpg", "image content");
    form.append("file", file);
    const res = await authenticatedApi(
      "/api/upload/profile-photo",
      authToken,
      {
        method: "POST",
        body: form,
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(typeof data.url).toBe("string");
    expect(typeof data.filename).toBe("string");
  });

  test("Upload profile photo without auth returns 401", async () => {
    const form = new FormData();
    const file = createTestFile("profile.jpg", "image content");
    form.append("file", file);
    const res = await api("/api/upload/profile-photo", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  test("Upload profile photo without file returns 400", async () => {
    const form = new FormData();
    const res = await authenticatedApi(
      "/api/upload/profile-photo",
      authToken,
      {
        method: "POST",
        body: form,
      }
    );
    await expectStatus(res, 400);
  });

  // ===== Authentication & Authorization =====

  test("Request without auth token returns 401", async () => {
    const res = await api("/api/consultant/profile");
    await expectStatus(res, 401);
  });

  test("Request with invalid token returns 401", async () => {
    const res = await authenticatedApi(
      "/api/consultant/profile",
      "invalid-token-xyz"
    );
    await expectStatus(res, 401);
  });

  // ===== Mother Token Validation =====

  test("Validate baby token without auth", async () => {
    const res = await api("/api/mothers/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyToken,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.babyName).toBe("Baby Updated");
    expect(data.consultantName).toBeDefined();
  });

  test("Validate nonexistent token returns 404", async () => {
    const res = await api("/api/mothers/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "NONEXISTENT-TOKEN-INVALID",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Validate token without required field returns 400", async () => {
    const res = await api("/api/mothers/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  // ===== Mother Registration =====

  test("Register mother for baby", async () => {
    const res = await authenticatedApi("/api/init/mother", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyToken,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(babyId);
    expect(data.motherUserId).toBe(userId);
  });

  test("Register mother with nonexistent token returns 404", async () => {
    const res = await authenticatedApi("/api/init/mother", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "XXXX",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Register mother without auth returns 401", async () => {
    const res = await api("/api/init/mother", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyToken,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Register mother without required token field returns 400", async () => {
    const res = await authenticatedApi("/api/init/mother", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Create mother account with baby token", async () => {
    // Create a new baby to get a fresh token
    const uniqueId = crypto.randomUUID();
    const babyRes = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby for Mother Account",
        birthDate: "2024-08-15",
        motherName: "New Mother",
        motherPhone: "+1234567890",
      }),
    });
    const babyData = await babyRes.json();
    const newBabyToken = babyData.token;

    const res = await api("/api/mothers/create-account-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: newBabyToken,
        email: `newmother+${uniqueId}@example.com`,
        password: "SecurePassword123!",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBeDefined();
    expect(data.user.email).toBeDefined();
    expect(data.token).toBeDefined();
  });

  test("Create mother account with nonexistent token returns 404", async () => {
    const res = await api("/api/mothers/create-account-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "NONEXISTENT-TOKEN",
        email: "test@example.com",
        password: "Password123!",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Create mother account without required fields returns 400", async () => {
    const res = await api("/api/mothers/create-account-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyToken,
        email: "test@example.com",
        // Missing password
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create mother account without email field returns 400", async () => {
    const res = await api("/api/mothers/create-account-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyToken,
        password: "Password123!",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create mother account without token field returns 400", async () => {
    const res = await api("/api/mothers/create-account-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create mother account when account already exists returns 409", async () => {
    // Create two babies for this test
    const uniqueId = crypto.randomUUID();
    const sharedEmail = `duplicate-account+${uniqueId}@example.com`;

    // Create first baby
    const baby1Res = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby for Duplicate Account 1",
        birthDate: "2024-09-15",
        motherName: "Duplicate Mother",
        motherPhone: "+1234567890",
      }),
    });
    const baby1Data = await baby1Res.json();
    const baby1Token = baby1Data.token;

    // Create second baby
    const baby2Res = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby for Duplicate Account 2",
        birthDate: "2024-09-16",
        motherName: "Duplicate Mother",
        motherPhone: "+1234567890",
      }),
    });
    const baby2Data = await baby2Res.json();
    const baby2Token = baby2Data.token;

    // Create account with first baby and email
    await api("/api/mothers/create-account-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: baby1Token,
        email: sharedEmail,
        password: "Password123!",
      }),
    });

    // Try to create another account with same email but different baby (should fail with 409)
    const res = await api("/api/mothers/create-account-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: baby2Token,
        email: sharedEmail,
        password: "Password123!",
      }),
    });
    await expectStatus(res, 409);
  });

  test("Link mother to baby with mothers/init-with-token endpoint", async () => {
    // Create new baby and new mother user
    const newBabyRes = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby for Mother Link",
        birthDate: "2024-06-15",
        motherName: "Mother Test",
        motherPhone: "+1234567890",
      }),
    });
    const newBabyData = await newBabyRes.json();
    const newBabyToken = newBabyData.token;

    // Create new mother user
    const { token: motherToken } = await signUpTestUser();

    // Mother links to baby
    const res = await authenticatedApi("/api/mothers/init-with-token", motherToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: newBabyToken,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(newBabyData.id);
    expect(data.name).toBe("Baby for Mother Link");
    expect(data.message).toBeDefined();
  });

  test("Link mother with nonexistent token returns 404", async () => {
    const { token: motherToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/mothers/init-with-token", motherToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "NONEXISTENT",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Link mother without auth returns 401", async () => {
    const res = await api("/api/mothers/init-with-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyToken,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Link mother without required token field returns 400", async () => {
    const { token: motherToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/mothers/init-with-token", motherToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Link mother that already registered returns 409", async () => {
    // Create baby and mother
    const babyRes = await authenticatedApi("/api/babies", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby for Duplicate Link",
        birthDate: "2024-07-15",
        motherName: "Duplicate Mother",
        motherPhone: "+1234567890",
      }),
    });
    const babyData = await babyRes.json();
    const babyTokenNew = babyData.token;

    const { token: motherToken } = await signUpTestUser();

    // First link
    await authenticatedApi("/api/mothers/init-with-token", motherToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyTokenNew,
      }),
    });

    // Try to link again (should fail with 409)
    const res = await authenticatedApi("/api/mothers/init-with-token", motherToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: babyTokenNew,
      }),
    });
    await expectStatus(res, 409);
  });

  // ===== Mother Baby Access =====

  test("Get baby linked to mother", async () => {
    const res = await authenticatedApi("/api/mother/baby", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(babyId);
    expect(data.motherUserId).toBe(userId);
    expect(data.ageMonths).toBeGreaterThanOrEqual(0);
    expect(data.ageDays).toBeGreaterThanOrEqual(0);
    expect(data.token).toBeDefined();
    expect(data.activeContract).toBeDefined();
  });

  test("Get mother baby without auth returns 401", async () => {
    const res = await api("/api/mother/baby");
    await expectStatus(res, 401);
  });

  test("Get mother baby when not registered returns 404", async () => {
    const { token: newMotherToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/mother/baby", newMotherToken);
    await expectStatus(res, 404);
  });

  // ===== Get Mother's Consultant =====

  test("Get consultant profile for mother's linked baby", async () => {
    const res = await authenticatedApi("/api/mother/consultant", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(consultantId);
    expect(data.name).toBe("Dr. Updated Consultant");
    expect(data.userId).toBeDefined();
  });

  test("Get mother consultant without auth returns 401", async () => {
    const res = await api("/api/mother/consultant");
    await expectStatus(res, 401);
  });

  test("Get mother consultant when not registered returns 404", async () => {
    const { token: newMotherToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/mother/consultant", newMotherToken);
    await expectStatus(res, 404);
  });
});
