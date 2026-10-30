# Complete local Docker preview

This runs the existing React → Spring Boot → MySQL architecture, with Mailpit
for profile email verification. The preview has its own database volume.

Create `.env` in the repository root (ignored by Git), setting three local
passwords of your choice:

```dotenv
UI_DB_PASSWORD=your-local-database-password
UI_OPERATIONS_PASSWORD=your-local-operations-password
UI_MANAGEMENT_PASSWORD=your-local-management-password
```

Start all four services:

```sh
docker compose -p elec5619-ui -f docker-compose.ui.yml up -d --build --wait
```

- App: http://localhost:5619
- API health: http://localhost:15619/api/health
- Local email inbox: http://localhost:8561
- Operations username: `demo.operations`
- Management username: `demo.management`

Passwords are the values configured in `.env`. Usernames are seeded only when
they do not already exist, so changing a password variable does not reset an
existing account. Demo systems and continuously refreshed readings are enabled.

After editing the frontend, rerun the startup command to rebuild the image.
Stop the preview while retaining its data:

```sh
docker compose -p elec5619-ui -f docker-compose.ui.yml down
```

The original `docker-compose.yml` and its development database remain separate.
