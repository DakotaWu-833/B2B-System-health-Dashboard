# B2B System Health Dashboard

## 1 Project Overview

The **B2B System Health Dashboard** is a full-stack web application designed to help small and medium-sized organisations monitor the health of their servers and software services through a centralised dashboard.

The system collects and displays basic operational metrics, including:

- CPU usage
- Memory usage
- Response time
- Service availability

These metrics are presented through a simple dashboard, allowing users to quickly understand the current status and performance of monitored systems.

The application also generates alerts when selected metrics exceed predefined thresholds.

Role-based access control is provided for two main user groups:

- **Operations Staff** — access detailed system information, manage monitored systems, and handle alerts.
- **Management Users** — view high-level system health information, KPI summaries, and alert summaries.

The project aims to provide a **simple, practical, and easy-to-use monitoring solution** without introducing unnecessary infrastructure or highly complex monitoring technologies.

---

## 2 Problem Statement

Businesses increasingly depend on servers and online services for their daily operations. When a server becomes overloaded, a service becomes unavailable, or response time increases significantly, these problems may affect employees or customers.

In small and medium-sized organisations, system information may be distributed across different tools or checked manually. This can make it difficult for operations staff to identify problems quickly.

At the same time, management users generally do not require detailed technical information but still need a clear overview of overall system health.

Therefore, there is a need for a centralised web application that can:

- Monitor important server and service metrics
- Provide an easy-to-understand system health dashboard
- Identify abnormal conditions through alerts
- Store historical monitoring information
- Provide different levels of access for technical staff and management

The **B2B System Health Dashboard** addresses these needs by presenting important monitoring information within a single web-based system.

---

## 3 Project Goals

The main goals of the project are to:

1. Provide a centralised dashboard for monitoring servers and services.
2. Display key system health metrics in a clear and understandable format.
3. Help users identify abnormal system conditions through threshold-based alerts.
4. Allow users to review both current and historical monitoring data.
5. Provide different system permissions for Operations Staff and Management Users.
6. Build a complete and maintainable full-stack web application using modern application frameworks.

---

## 4 Target Users

### 4.1 Operations Staff

Operations Staff are responsible for monitoring and maintaining servers and services.

They should be able to:

- Log in to the system
- View all monitored servers and services
- View detailed system metrics
- View current and historical alerts
- Add or update monitored systems
- Acknowledge or resolve alerts

### 4.2 Management Users

Management Users primarily require an overview of business system health rather than detailed technical information.

They should be able to:

- Log in to the system
- View the main dashboard
- View high-level KPIs
- View overall server and service status
- View alert summaries

Management Users will have more limited permissions than Operations Staff.

---

## 5 Key Functional Requirements

### 5.1 User Authentication

The system will provide a login function for registered users.

Each user account will contain a role that determines which features the user is allowed to access.

The initial system will support two roles:

- **Operations**
- **Management**

### 5.2 Role-Based Access Control

The application will provide different access permissions depending on the user's role.

**Operations users** will be able to access detailed monitoring and system management features.

**Management users** will mainly have read-only access to high-level dashboards and system health summaries.

This prevents users from accessing functions that are not relevant to their responsibilities.

### 5.3 Server and Service Management

Operations users will be able to maintain a list of monitored servers and services.

Each monitored item may include:

- System or service name
- Type
- Host or identifier
- Current status
- Description

The first version of the project will focus on a small number of monitored systems to keep implementation manageable.

### 5.4 Metrics Monitoring

The system will store and display several basic health metrics.

The initial metrics will include:

| Metric        | Unit / Value |
| ------------- | ------------ |
| CPU Usage     | %            |
| Memory Usage  | %            |
| Response Time | ms           |
| Availability  | Status       |

Metric records will contain timestamps so that users can review historical system performance.

For the prototype, monitoring data may be generated or periodically submitted to the backend rather than requiring the development of a complex external monitoring agent.

### 5.5 KPI Dashboard

The main dashboard will provide an overview of overall system health.

The dashboard may display:

- Total number of monitored systems
- Number of healthy systems
- Number of systems with warnings or critical status
- Number of active alerts
- Average CPU usage
- Average memory usage
- Average response time

Simple charts will be used to display recent metric trends.

### 5.6 System Health Status

Each monitored server or service will have one of the following health statuses:

| Status       | Description                                          |
| ------------ | ---------------------------------------------------- |
| **Healthy**  | System is operating normally                         |
| **Warning**  | One or more metrics have exceeded warning thresholds |
| **Critical** | One or more metrics have reached critical levels     |
| **Offline**  | System or service is unavailable                     |

The status will be determined using predefined thresholds based on the latest monitoring data.

For example, high CPU or memory usage may change a system's status from **Healthy** to **Warning** or **Critical**.

### 5.7 Alert Management

The system will automatically generate an alert when a monitored metric exceeds a predefined threshold.

An alert will contain information such as:

- Affected server or service
- Alert type
- Severity
- Alert message
- Creation time
- Current status

Operations users will be able to view and update the status of alerts.

For the first version, alerts will be displayed within the web application.

External SMS, email, and third-party notification integrations are outside the initial project scope.

### 5.8 Historical Data

The system will store historical metric and alert records in the database.

Users will be able to view recent metric history for a selected server or service.

This allows users to determine whether a problem is temporary or part of a longer-term trend.

---

## 6 Main Use Cases

### Operations Staff

1. Log in to the system.
2. View the system health dashboard.
3. View the list of monitored servers and services.
4. View detailed metrics for a selected system.
5. Add or update a monitored system.
6. View active alerts.
7. Acknowledge or resolve an alert.
8. Review historical metrics and alerts.

### Management Users

1. Log in to the system.
2. View high-level system health KPIs.
3. View overall server and service status.
4. View alert summaries.
5. Review recent system health trends.

---

## 7 Proposed Technology Stack

| Layer              | Technology      | Purpose                                                      |
| ------------------ | --------------- | ------------------------------------------------------------ |
| Frontend           | **React**       | Dashboard, system list, alert pages, navigation, and charts  |
| Backend            | **Spring Boot** | REST APIs, authentication, business logic, and data processing |
| Database           | **MySQL**       | Persistent storage for users, systems, metrics, and alerts   |
| Version Control    | **GitHub**      | Source code management and team collaboration                |
| Project Management | **JIRA**        | Product backlog, sprint tasks, responsibilities, and project progress |

### Frontend — React

React will be used to build the web interface, including:

- Dashboard
- System list
- Alert pages
- Charts and KPI visualisations

### Backend — Spring Boot

Spring Boot will provide REST APIs for:

- User authentication
- Server and service management
- Metric management
- Dashboard information
- Alert management

### Database — MySQL

MySQL will store persistent application data, including:

- Users
- Servers and services
- Metric records
- Alerts

---

## 8 High-Level System Architecture

The proposed system follows a simple three-layer full-stack architecture:

```text
┌─────────────────────┐
│        Users         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    React Frontend    │
│      Dashboard       │
└──────────┬──────────┘
           │
           │ REST API
           ▼
┌─────────────────────┐
│ Spring Boot Backend  │
│   Business Logic     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   MySQL Database     │
└─────────────────────┘
```

Monitoring data will be stored through the Spring Boot backend and retrieved by the React frontend for dashboard visualisation.

This architecture keeps the application simple enough for the project while clearly separating:

- **Presentation layer** — React
- **Business logic layer** — Spring Boot
- **Data layer** — MySQL

---

## 9 Initial Data Model

The application is expected to contain four main entities.

### 9.1 User

Stores information about system users.

| Attribute  | Description                    |
| ---------- | ------------------------------ |
| `userId`   | Unique identifier for the user |
| `username` | User's login name              |
| `password` | User authentication credential |
| `role`     | User's system role             |

### 9.2 MonitoredSystem

Stores information about monitored servers or services.

| Attribute     | Description                   |
| ------------- | ----------------------------- |
| `systemId`    | Unique identifier             |
| `name`        | System or service name        |
| `type`        | Type of monitored system      |
| `host`        | Host address or identifier    |
| `status`      | Current health status         |
| `description` | Additional system information |

### 9.3 Metric

Stores monitoring information collected for a monitored system.

| Attribute      | Description                           |
| -------------- | ------------------------------------- |
| `metricId`     | Unique metric record identifier       |
| `systemId`     | Associated monitored system           |
| `cpuUsage`     | CPU usage percentage                  |
| `memoryUsage`  | Memory usage percentage               |
| `responseTime` | Response time in milliseconds         |
| `availability` | Availability status                   |
| `timestamp`    | Time at which the metric was recorded |

### 9.4 Alert

Stores alerts generated by abnormal metrics.

| Attribute     | Description                 |
| ------------- | --------------------------- |
| `alertId`     | Unique alert identifier     |
| `systemId`    | Associated monitored system |
| `alertType`   | Type of alert               |
| `severity`    | Alert severity              |
| `message`     | Alert description           |
| `status`      | Current alert status        |
| `createdTime` | Alert creation time         |

> The detailed database schema may be refined during later development sprints.

---

## 10 Project Scope

To ensure that the system can be realistically implemented within the semester, the first version will focus on the core monitoring workflow.

### In Scope

- User login
- Two user roles
- Server and service management
- Basic server and service metrics
- Dashboard KPI visualisation
- Simple historical metric charts
- Threshold-based alerts
- Alert status management
- Persistent MySQL data storage

### Out of Scope

The following features are not required for the initial implementation:

- Complex monitoring agents installed on real production servers
- Machine-learning-based anomaly detection
- SMS notifications
- Email notifications
- Integration with external monitoring platforms
- Cloud infrastructure deployment automation
- Advanced predictive analytics

These features may be considered as future extensions if sufficient development time remains.

---

## 11 Team Roles and Responsibilities

The project will be developed collaboratively. Each member will have a primary responsibility while also contributing to shared tasks such as testing, documentation, and code review.

| Team Member      | Primary Role                            | Responsibilities                                             |
| ---------------- | --------------------------------------- | ------------------------------------------------------------ |
| **Zhouguang Li** | Project Coordinator / Backend Developer | Coordinate project progress, manage JIRA tasks, support Spring Boot development, and integrate project components |
| **Bingyang Wu**  | Frontend Developer                      | Develop the React user interface, dashboard pages, navigation, and KPI visualisation |
| **Yixuan Huang** | Backend Developer                       | Develop Spring Boot REST APIs, business logic, authentication, and role-based access functionality |
| **Zeheng Li**    | Database / Backend Developer            | Design the MySQL database, implement entity relationships, data persistence, and metric/alert data management |
| **Wentao Chen**  | Testing / Full-Stack Developer          | Develop test cases, perform functional and integration testing, support frontend/backend development, and maintain project documentation |

Roles may be adjusted during later sprints depending on project requirements and team workload.

---

## 12 Expected Outcome

By the end of the project, the team aims to deliver a functional full-stack web application that allows users to monitor server and service health through a central dashboard.

The final application should demonstrate the complete workflow:

```text
Monitor System
      ↓
Store Metrics
      ↓
Display KPIs
      ↓
Detect Abnormal Conditions
      ↓
Generate Alerts
      ↓
Support Role-Based Users
```

The project will prioritise a **reliable and functional implementation of the core features** before considering additional advanced functionality.
