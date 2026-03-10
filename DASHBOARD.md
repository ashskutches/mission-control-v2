# Mission Control Dashboard (v3)

A professional, mobile-first business intelligence dashboard built with **Next.js** and **Bulma.io**. It provides a real-time "glassmorphic" interface for monitoring and managing the Gravity Claw agent network.

## Design System

### Bulma.io Integration
The dashboard utilizes Bulma for its responsive grid, core components (`hero`, `level`, `media`, `box`), and mobile-first approach. Custom "Midnight Glass" styling is layered on top via `src/app/globals.css`.

### Main Layout
- **Sidebar**: High-level navigation across functional "Nodes."
- **Situation Room (Overview)**: Real-time pulse of revenue, node count, and strategic recommendations.
- **War Room**: Dynamic agent roster and cross-unit execution logs.
- **Commerce**: 5X Growth Mission tracking against strategic milestones.

## Component Architecture (`src/components/`)

### 1. Data Visualization
- **SalesChart.tsx**: Dynamic ECharts integration for revenue and margin trends.
- **GrowthTracker.tsx**: Milestone-based progress bar for strategic objectives.
- **NeuralExplorer.tsx**: Interactive graph showing the agent's knowledge synapse.

### 2. Operational Control
- **AgentRoster.tsx**: Real-time listing of active units and their heartbeat.
- **RosterManager.tsx**: Administrative interface for adjusting agent thinking levels and providers.
- **MissionTracker.tsx**: Detailed drill-down into specific autonomous missions.

### 3. Vitals & Health
- **ProviderMatrix.tsx**: Allocation map of compute across LLM providers.
- **StatCard.tsx**: High-impact metrics used throughout the dashboard.

## Real-time Data Flow

1. **Backend Sync**: Gravity Claw populates **Supabase** with "Facts" and "Activity Logs."
2. **Frontend Fetch**: The React components fetch this state via server-side props and client-side hooks.
3. **Synergy**: The `SynergyFeed.tsx` maintains a persistent connection to track heartbeat pulses from the agent network.
