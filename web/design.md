# askRepo Design System & Aesthetic Guidelines

## 1. Core Principles
- **Monochrome & Linear Accent**: Ultra-sleek, developer-first dark mode inspired by Linear.
- **Zero Gradients**: No rainbow gradients, no glowing radial blobs, no multi-color text masks (`bg-clip-text`).
- **High Contrast & Sharp**: Clean lines, subtle 1px borders, crisp typography.

---

## 2. Color Palette Tokens

| Element | Hex Code | Tailwind Utility |
| :--- | :--- | :--- |
| **Main Page Background** | `#010102` | `bg-[#010102]` |
| **Card / Panel Background** | `#0d0d0e` | `bg-[#0d0d0e]` |
| **Header / Sidebar Background** | `#09090b` | `bg-[#09090b]` |
| **Input / Field Background** | `#131416` | `bg-[#131416]` |
| **Border Color** | `#23252a` | `border-[#23252a]` |
| **Hover Border Color** | `#3a3f47` | `hover:border-[#3a3f47]` |
| **Primary Text** | `#f7f8f8` | `text-[#f7f8f8]` |
| **Secondary Text** | `#8a8f98` | `text-[#8a8f98]` |
| **Muted / Placeholder** | `#62666d` | `text-[#62666d]` |
| **Primary Action Button (Linear Purple)** | `#5e6ad2` (text `#ffffff`) | `bg-[#5e6ad2] text-white hover:bg-[#4e58b5]` |
| **Secondary Button** | `#1e2024` | `bg-[#1e2024] text-[#f7f8f8] hover:bg-[#23252a]` |

---

## 3. Component & Layout Rules
- **Logged Out User State**: Landing page `/` renders without a sidebar. Shows project overview, feature showcase, and a prominent "Log In" button. Action inputs are disabled/restricted until login.
- **Logged In User State**: Full dashboard with sidebar, repo list, sync actions, and instant chat.
- **Primary Buttons**: All primary action buttons (Index Repo, Log In) use Linear's brand purple `#5e6ad2`.
