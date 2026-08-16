# B2B System Health Dashboard

## 1. Project Overview

The B2B System Health Dashboard is a full-stack web application designed to help small and medium-sized organisations monitor the health of their servers and software services from a central dashboard.

The system collects basic operational metrics such as CPU usage, memory usage, response time, and service availability. These metrics are displayed through a simple dashboard so that users can quickly understand the current status of monitored systems.

The application also generates alerts when selected metrics exceed predefined thresholds. Role-based access will be provided for two main user groups: **Operations Staff** and **Management Users**. Operations staff will have access to detailed system information and alert management, while management users will mainly view high-level system health and KPI summaries.

The project aims to provide a simple, practical, and easy-to-use monitoring solution without introducing unnecessary infrastructure or highly complex monitoring technologies.


## 2. Problem Statement

Businesses increasingly depend on servers and online services for their daily operations. When a server becomes overloaded, a service becomes unavailable, or response time increases significantly, the problem may affect employees or customers.

In small or medium-sized organisations, system information may be distributed across different tools or checked manually. This can make it difficult for operations staff to identify problems quickly. At the same time, managers usually do not need detailed technical information but still need a clear overview of overall system health.

Therefore, there is a need for a centralised web application that can:

* monitor important server and service metrics;
* provide an easy-to-understand system health dashboard;
* identify abnormal conditions through alerts;
* store historical monitoring information; and
* provide different levels of access for technical staff and management.

The B2B System Health Dashboard addresses this problem by presenting important monitoring information in one web-based system.


## 3. Project Goals

The main goals of the project are to:

1. Provide a centralised dashboard for monitoring servers and services.
2. Display key system health metrics in a clear and understandable format.
3. Help users identify abnormal system conditions through threshold-based alerts.
4. Allow users to review both current and historical monitoring data.
5. Provide different system permissions for Operations Staff and Management Users.
6. Build a complete and maintainable full-stack web application using modern application frameworks.


## 4. Target Users

### 4.1 Operations Staff

Operations Staff are responsible for monitoring and maintaining servers and services.

They should be able to:

* log in to the system;
* view all monitored servers and services;
* view detailed system metrics;
* view current and historical alerts;
* add or update monitored systems;
* acknowledge or resolve alerts.

### 4.2 Management Users

Management Users mainly need an overview of business system health rather than detailed technical information.

They should be able to:

* log in to the system;
* view the main dashboard;
* view high-level KPIs;
* view overall server and service status;
* view alert summaries.

Management Users will have more limited permissions than Operations Staff.


## 5. Key Functional Requirements

### 5.1 User Authentication

The system will provide a login function for registered users.

Each user account will contain a role that determines which features the user is allowed to access.

The initial system will support two roles:

* **Operations**
* **Management**


### 5.2 Role-Based Access Control

The application will provide different access permissions depending on the user's role.

**Operations users** will be able to access detailed monitoring and system management features.

**Management users** will mainly have read-only access to high-level dashboards and system health summaries.

This prevents users from accessing functions that are not relevant to their responsibilities.


### 5.3 Server and Service Management

Operations users will be able to maintain a list of monitored servers and services.

Each monitored item may include basic information such as:

* system/service name;
* type;
* host or identifier;
* current status;
* description.

The first version of the project will focus on a small number of monitored systems to keep implementation manageable.


### 5.4 Metrics Monitoring

The system will store and display several basic health metrics.

The initial metrics will include:

* **CPU Usage (%)**
* **Memory Usage (%)**
* **Response Time (ms)**
* **Availability Status**

Metric records will contain a timestamp so that users can review historical system performance.

For the prototype, monitoring data may be generated or periodically submitted to the backend rather than requiring the development of a complex external monitoring agent.


### 5.5 KPI Dashboard

The main dashboard will provide an overview of system health.

The dashboard may display:

* total number of monitored systems;
* number of healthy systems;
* number of systems with warnings or critical status;
* number of active alerts;
* average CPU usage;
* average memory usage;
* average response time.

Simple charts will be used to display recent metric trends.


### 5.6 System Health Status

Each monitored server or service will have a health status such as:

* **Healthy**
* **Warning**
* **Critical**
* **Offline**

The status will be determined using simple predefined thresholds based on the latest monitoring data.

For example, a high CPU or memory value may change the status from Healthy to Warning or Critical.


### 5.7 Alert Management

The system will automatically generate an alert when a monitored metric exceeds a predefined threshold.

An alert will contain information such as:

* affected server or service;
* alert type;
* severity;
* alert message;
* creation time;
* current status.

Operations users will be able to view and update the status of alerts.

For the first version, alerts will be displayed within the web application. External SMS, email, or third-party notification integration is outside the initial project scope.


### 5.8 Historical Data

The system will store historical metric and alert records in the database.

Users will be able to view recent metric history for a selected server or service.

This allows users to understand whether a problem is temporary or part of a longer trend.


## 6. Main Use Cases

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
3. View overall server/service status.
4. View alert summaries.
5. Review recent system health trends.


## 7. Proposed Technology Stack

### Frontend

**React**

React will be used to build the web interface, including the dashboard, system list, alert pages, and charts.

### Backend

**Spring Boot**

Spring Boot will provide REST APIs for:

* user authentication;
* server/service management;
* metric management;
* dashboard information;
* alert management.

### Database

**MySQL**

MySQL will store persistent application data, including:

* users;
* servers and services;
* metric records;
* alerts.

### Version Control

**GitHub**

GitHub will be used for source code management and team collaboration.

### Project Management

**JIRA**

JIRA will be used to manage the product backlog, sprint tasks, responsibilities, and project progress.


## 8. High-Level System Architecture

The proposed system follows a simple three-layer full-stack architecture:

```text
Users
  |
  v
React Frontend
  |
  | REST API
  v
Spring Boot Backend
  |
  v
MySQL Database
```

Monitoring data will be stored through the Spring Boot backend and retrieved by the React frontend for dashboard visualisation.

This architecture keeps the application simple enough for the project while clearly separating the presentation, business logic, and data layers.


## 9. Initial Data Model

The application is expected to contain four main entities.

### User

Stores information about system users.

Example attributes:

* userId
* username
* password
* role

### MonitoredSystem

Stores information about servers or services.

Example attributes:

* systemId
* name
* type
* host
* status
* description

### Metric

Stores monitoring information.

Example attributes:

* metricId
* systemId
* CPU usage
* memory usage
* response time
* availability
* timestamp

### Alert

Stores alerts generated by abnormal metrics.

Example attributes:

* alertId
* systemId
* alert type
* severity
* message
* status
* created time

The detailed database schema may be refined during later development sprints.


## 10. Project Scope

To ensure that the system can be realistically implemented within the semester, the first version will focus on the core monitoring workflow.

### In Scope

* user login;
* two user roles;
* server/service management;
* basic server/service metrics;
* dashboard KPI visualisation;
* simple historical metric charts;
* threshold-based alerts;
* alert status management;
* persistent MySQL data storage.

### Out of Scope for the Initial Version

The following features are not required for the initial implementation:

* development of a complex monitoring agent installed on real production servers;
* machine-learning-based anomaly detection;
* SMS notifications;
* email notifications;
* integration with external monitoring platforms;
* cloud infrastructure deployment automation;
* advanced predictive analytics.

These features may be considered as future extensions if sufficient development time remains.


## 11. Team Roles and Responsibilities

The project will be developed collaboratively. Each member will have a primary responsibility while also contributing to shared tasks such as testing, documentation, and code review.

| Team Member        | Primary Role                            | Responsibilities                                                                                                                          |
| -------------------| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **[Zhouguang Li]** | Project Coordinator / Backend Developer | Coordinate project progress, manage JIRA tasks, support Spring Boot development, and integrate project components.                        |
| **[Bingyang Wu]**  | Frontend Developer                      | Develop the React user interface, dashboard pages, navigation, and KPI visualisation.                                                     |
| **[Yixuan Huang]** | Backend Developer                       | Develop Spring Boot REST APIs, business logic, authentication, and role-based access functionality.                                       |
| **[Zeheng Li]**    | Database / Backend Developer            | Design the MySQL database, implement entity relationships, data persistence, and metric/alert data management.                            |
| **[Wentao Chen]**  | Testing / Full-Stack Developer          | Develop test cases, perform functional and integration testing, support frontend/backend development, and maintain project documentation. |

Roles may be adjusted during later sprints depending on project requirements and team workload.


## 12. Expected Outcome

By the end of the project, the team aims to deliver a functional full-stack web application that allows users to monitor server and service health through a central dashboard.

The final application should demonstrate a complete workflow:

**Monitor System → Store Metrics → Display KPIs → Detect Abnormal Conditions → Generate Alerts → Support Role-Based Users**

The project will prioritise a reliable and functional implementation of these core features before considering additional advanced functionality.
