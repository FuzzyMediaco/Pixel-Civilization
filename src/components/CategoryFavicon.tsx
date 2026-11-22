import React from "react";
import type { DecisionTreeParentId } from "../game/quickBuildTree";
import type { BuildCategory } from "./BuildSheet";

export const CATEGORY_LABELS: Record<BuildCategory, string> = {
  suggested: "Suggested",
  custom: "Pix Custom",
  housing: "Homes",
  roads_transit: "Roads & Transit",
  commerce: "Shops & Work",
  agriculture: "Food & Farms",
  power_waste: "Power & Waste",
  water_util: "Water",
  civic_parks: "Civic & Parks",
  police_military: "Safety & Defense",
  faith: "Faith",
  maritime: "Harbor",
  nature_terrain: "Nature",
  landmarks: "Landmarks",
  wealth_projects: "Wealth",
  works: "Land & Water",
  all: "All",
  starter: "Starter",
};

/**
 * Bespoke miniature isometric/voxel SVG favicons for every element category.
 * Used in both the empty-tile Quick-Build Spiral Menu and the main Build / Atlas menus.
 */
export function CategoryFavicon({
  category,
  size = 20,
  className = "",
}: {
  category: BuildCategory;
  size?: number;
  className?: string;
}) {
  const cls = ("cat-favicon " + className).trim();
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    className: cls,
  };

  switch (category) {
    case "housing":
      return (
        <svg {...common}>
          {/* Cozy voxel cottage */}
          <polygon points="12,3 21,9.5 19,11 12,6 5,11 3,9.5" fill="#d45d48" />
          <polygon points="12,5.5 19,10.5 19,20 5,20 5,10.5" fill="#f5e6cc" stroke="#8a5a3c" strokeWidth="1.2" strokeLinejoin="round" />
          <rect x="10" y="14" width="4" height="6" rx="0.6" fill="#8a5a3c" />
          <rect x="7" y="11" width="2.8" height="2.6" rx="0.4" fill="#6cc4e8" />
          <rect x="14.2" y="11" width="2.8" height="2.6" rx="0.4" fill="#6cc4e8" />
          <rect x="16" y="4.5" width="2.2" height="4" fill="#b44937" />
        </svg>
      );

    case "roads_transit":
      return (
        <svg {...common}>
          {/* Asphalt street with lane dashes and curb */}
          <polygon points="7,3 17,3 21,21 3,21" fill="#465359" stroke="#263136" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M5,20 L8.2,4 M19,20 L15.8,4" stroke="#d9e0d6" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="12" y1="5.5" x2="12" y2="8.5" stroke="#f5c94c" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="12" y1="11.5" x2="12" y2="14.5" stroke="#f5c94c" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="12" y1="17.5" x2="12" y2="19.5" stroke="#f5c94c" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case "commerce":
      return (
        <svg {...common}>
          {/* Storefront with striped awning */}
          <rect x="4" y="10" width="16" height="10" rx="1.2" fill="#f7efe1" stroke="#6f533a" strokeWidth="1.2" />
          <polygon points="3,10 5.5,4.5 18.5,4.5 21,10" fill="#e0654a" stroke="#9e3924" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M8,4.5 L7.2,10 M12,4.5 L12,10 M16,4.5 L16.8,10" stroke="#fff6e8" strokeWidth="1.6" />
          <rect x="6.5" y="12.5" width="5.5" height="4.5" rx="0.6" fill="#63bce2" />
          <rect x="14" y="12.5" width="3.5" height="7.5" rx="0.5" fill="#8b5a3c" />
        </svg>
      );

    case "agriculture":
      return (
        <svg {...common}>
          {/* Golden crop field & red barn */}
          <path d="M3,15.5 C7,13.5 17,13.5 21,15.5 L21,20.5 L3,20.5 Z" fill="#d9a938" stroke="#8a6516" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M5,18.2 L19,18.2 M6.5,16.2 L17.5,16.2" stroke="#f6dc82" strokeWidth="1.1" strokeLinecap="round" />
          <polygon points="12,4 18.5,8.5 17.5,14.5 6.5,14.5 5.5,8.5" fill="#c94338" stroke="#7a231c" strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="10" y="9.8" width="4" height="4.7" fill="#fff3e0" />
          <path d="M10.2,10 L13.8,14.2 M13.8,10 L10.2,14.2" stroke="#c94338" strokeWidth="0.9" />
        </svg>
      );

    case "power_waste":
      return (
        <svg {...common}>
          {/* Crisp energy bolt badge */}
          <circle cx="12" cy="12" r="9.2" fill="#234d47" stroke="#163530" strokeWidth="1.2" />
          <polygon points="13.2,4.2 6.8,13 11.4,13 10.6,19.8 17.2,10.8 12.6,10.8" fill="#ffd447" stroke="#b57f0b" strokeWidth="0.9" strokeLinejoin="round" />
        </svg>
      );

    case "water_util":
      return (
        <svg {...common}>
          {/* Sparkling water droplet */}
          <path d="M12,3.2 C12,3.2 5.5,10.8 5.5,14.8 C5.5,18.5 8.4,21 12,21 C15.6,21 18.5,18.5 18.5,14.8 C18.5,10.8 12,3.2 12,3.2 Z" fill="#3da4e8" stroke="#1c689e" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M9.3,15 C9.3,16.8 10.5,18 12,18" stroke="#c6ecff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case "civic_parks":
      return (
        <svg {...common}>
          {/* Classical civic hall with park tree */}
          <polygon points="4,9 12,4 20,9" fill="#d9e4dc" stroke="#365c4d" strokeWidth="1.2" strokeLinejoin="round" />
          <rect x="5" y="9" width="14" height="10" fill="#f7f8f2" stroke="#365c4d" strokeWidth="1.2" />
          <path d="M8.5,9.5 V18.5 M12,9.5 V18.5 M15.5,9.5 V18.5" stroke="#5c7d6e" strokeWidth="1.5" />
          <rect x="3.5" y="18.5" width="17" height="2.2" rx="0.6" fill="#365c4d" />
          <circle cx="18.5" cy="14" r="3.2" fill="#4aa65c" stroke="#225e32" strokeWidth="1" />
        </svg>
      );

    case "police_military":
      return (
        <svg {...common}>
          {/* Navy & gold safety/defense shield */}
          <path d="M12,3 L19.5,6.2 V12 C19.5,16.8 16.3,19.8 12,21.2 C7.7,19.8 4.5,16.8 4.5,12 V6.2 Z" fill="#254878" stroke="#162d4d" strokeWidth="1.2" strokeLinejoin="round" />
          <polygon points="12,7.2 13.4,10.3 16.8,10.6 14.2,12.8 15,16.1 12,14.3 9,16.1 9.8,12.8 7.2,10.6 10.6,10.3" fill="#f6c94e" />
        </svg>
      );

    case "faith":
      return (
        <svg {...common}>
          {/* Sanctuary dome & spire */}
          <rect x="11.2" y="2.8" width="1.6" height="4.2" fill="#d1a036" />
          <rect x="9.6" y="4.2" width="4.8" height="1.5" fill="#d1a036" />
          <path d="M6,12 C6,8.2 8.7,6.2 12,6.2 C15.3,6.2 18,8.2 18,12 Z" fill="#e5c77e" stroke="#85652a" strokeWidth="1.1" />
          <rect x="5" y="12" width="14" height="8.5" rx="0.8" fill="#f7f2e3" stroke="#85652a" strokeWidth="1.2" />
          <path d="M10,20.5 V15.5 C10,14.2 14,14.2 14,15.5 V20.5" fill="#7c9eb8" />
        </svg>
      );

    case "maritime":
      return (
        <svg {...common}>
          {/* Harbor anchor & waves */}
          <circle cx="12" cy="6.2" r="2.2" stroke="#1e5675" strokeWidth="1.6" fill="#d9eef7" />
          <line x1="12" y1="8.4" x2="12" y2="18.2" stroke="#1e5675" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="8.5" y1="11.2" x2="15.5" y2="11.2" stroke="#1e5675" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6.2,14.2 C6.2,17.8 9.2,19.4 12,19.4 C14.8,19.4 17.8,17.8 17.8,14.2" stroke="#1e5675" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M3.5,20.4 Q7.5,18.4 12,20.4 Q16.5,22.4 20.5,20.4" stroke="#3aa4d8" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case "nature_terrain":
      return (
        <svg {...common}>
          {/* Layered voxel pine & broadleaf trees */}
          <polygon points="9.5,3.5 15,11 12.5,11 16,16.5 3,16.5 6.5,11 4,11" fill="#3a8f4c" stroke="#1f592c" strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="8.4" y="16.5" width="2.2" height="4" fill="#7a5233" />
          <circle cx="17.2" cy="12.2" r="4" fill="#63b859" stroke="#2c6e35" strokeWidth="1.1" />
          <rect x="16.2" y="16" width="2" height="4.5" fill="#7a5233" />
        </svg>
      );

    case "landmarks":
      return (
        <svg {...common}>
          {/* Golden monument obelisk */}
          <polygon points="12,2.5 14.5,6.2 15.5,18.5 8.5,18.5 9.5,6.2" fill="#f2d68d" stroke="#8a6a24" strokeWidth="1.2" strokeLinejoin="round" />
          <line x1="12" y1="3.5" x2="12" y2="18.2" stroke="#fff4cf" strokeWidth="1.1" />
          <rect x="6" y="18.5" width="12" height="2.6" rx="0.7" fill="#a88b4a" stroke="#6b531c" strokeWidth="1" />
        </svg>
      );

    case "wealth_projects":
      return (
        <svg {...common}>
          {/* Gleaming faceted gem */}
          <polygon points="7.5,4.5 16.5,4.5 21,9.8 12,20.5 3,9.8" fill="#32b89a" stroke="#146353" strokeWidth="1.2" strokeLinejoin="round" />
          <polygon points="7.5,4.5 16.5,4.5 14.5,9.8 9.5,9.8" fill="#8ff2d9" />
          <polygon points="9.5,9.8 14.5,9.8 12,20.5" fill="#23947b" />
        </svg>
      );

    case "custom":
      return (
        <svg {...common}>
          {/* PixBuilder isometric voxel cube */}
          <polygon points="12,3 20,7.5 12,12 4,7.5" fill="#5ce0c4" stroke="#18594c" strokeWidth="1.1" strokeLinejoin="round" />
          <polygon points="4,7.5 12,12 12,21 4,16.5" fill="#2a9d86" stroke="#18594c" strokeWidth="1.1" strokeLinejoin="round" />
          <polygon points="20,7.5 12,12 12,21 20,16.5" fill="#1d6f61" stroke="#18594c" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );

    case "works":
      return (
        <svg {...common}>
          {/* Sculpted terrain & canal */}
          <polygon points="3,17 9,7 14,13 17,9.5 21,17" fill="#7c9c64" stroke="#365432" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M3,19.5 Q8,17.2 12,19.5 Q16,21.8 21,19.5" stroke="#3aa4d8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "suggested":
    case "starter":
      return (
        <svg {...common}>
          {/* Compass starburst */}
          <circle cx="12" cy="12" r="8.8" fill="#e9f4ec" stroke="#1e6243" strokeWidth="1.2" />
          <polygon points="12,4.8 14.2,9.8 19.2,12 14.2,14.2 12,19.2 9.8,14.2 4.8,12 9.8,9.8" fill="#1e6243" />
          <circle cx="12" cy="12" r="1.8" fill="#f7d154" />
        </svg>
      );

    case "all":
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6.8" height="6.8" rx="1.5" fill="#d45d48" />
          <rect x="13.2" y="4" width="6.8" height="6.8" rx="1.5" fill="#3da4e8" />
          <rect x="4" y="13.2" width="6.8" height="6.8" rx="1.5" fill="#4aa65c" />
          <rect x="13.2" y="13.2" width="6.8" height="6.8" rx="1.5" fill="#e8b83c" />
        </svg>
      );
  }
}

/**
 * Bespoke miniature voxel SVG favicons for the 7 Parent Categories
 * of the Quick-Build Decision Tree (7 × 7 × 6).
 */
export function DecisionParentFavicon({
  parentId,
  size = 24,
  className = "",
}: {
  parentId: DecisionTreeParentId;
  size?: number;
  className?: string;
}) {
  const cls = ("cat-favicon " + className).trim();
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    className: cls,
  };

  switch (parentId) {
    case "homes_retail":
      return (
        <svg {...common}>
          {/* Cozy home + shop awning */}
          <polygon points="8.5,4 15,8.8 14,10 8.5,6 3,10 2,8.8" fill="#d45d48" />
          <rect x="3.5" y="9" width="10" height="10.5" rx="0.8" fill="#f5e6cc" stroke="#8a5a3c" strokeWidth="1.1" />
          <rect x="7" y="14" width="3" height="5.5" fill="#8a5a3c" />
          <rect x="12.5" y="11" width="8.5" height="8.5" rx="0.8" fill="#fff6e6" stroke="#8b5a2b" strokeWidth="1.1" />
          <path d="M12,11 L21.5,11 L20.8,14 L12.7,14 Z" fill="#e06544" />
          <rect x="14.5" y="15.4" width="4.5" height="2.6" rx="0.4" fill="#6cc4e8" />
        </svg>
      );

    case "roads_harbor":
      return (
        <svg {...common}>
          {/* Curved road + harbor wave */}
          <path d="M4,18 L9,5 L15,5 L20,18 Z" fill="#4f5a64" stroke="#2c353d" strokeWidth="1.1" strokeLinejoin="round" />
          <line x1="12" y1="6.8" x2="12" y2="9.6" stroke="#f7d154" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12" y1="12.2" x2="12" y2="15" stroke="#f7d154" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M2.5,20.2 Q7.5,18 12,20.2 Q16.5,22.4 21.5,20.2" stroke="#2f9bd6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "farms_nature":
      return (
        <svg {...common}>
          {/* Red barn + pine tree */}
          <polygon points="9.5,5.5 15.5,10 15.5,19.5 3.5,19.5 3.5,10" fill="#c94638" stroke="#6b241c" strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="7.5" y="13.5" width="4" height="6" fill="#f5e6cc" />
          <polygon points="18,6.5 22,13.5 14,13.5" fill="#449950" />
          <polygon points="18,10.5 22.4,17 13.6,17" fill="#327c3e" />
          <rect x="17" y="17" width="2" height="2.8" fill="#7a4f2b" />
        </svg>
      );

    case "power_water_tech":
      return (
        <svg {...common}>
          {/* Lightning bolt + water drop */}
          <polygon points="11.5,3.2 4.8,13 9.8,13 8.4,20.8 15.4,10.8 10.6,10.8" fill="#f6c436" stroke="#8a5a08" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M18.2,11.2 C18.2,11.2 21.4,15.3 21.4,17.5 C21.4,19.3 20,20.7 18.2,20.7 C16.4,20.7 15,19.3 15,17.5 C15,15.3 18.2,11.2 18.2,11.2 Z" fill="#3da4e8" stroke="#1c6196" strokeWidth="1.1" />
        </svg>
      );

    case "civic_culture_faith":
      return (
        <svg {...common}>
          {/* Classical civic hall + park canopy */}
          <polygon points="12,4 20.5,8.5 3.5,8.5" fill="#d9a441" stroke="#6b4e16" strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="4.5" y="8.5" width="15" height="9.5" fill="#f3efe2" stroke="#6b6859" strokeWidth="1.1" />
          <line x1="8" y1="9.2" x2="8" y2="17.5" stroke="#8b8775" strokeWidth="1.6" />
          <line x1="12" y1="9.2" x2="12" y2="17.5" stroke="#8b8775" strokeWidth="1.6" />
          <line x1="16" y1="9.2" x2="16" y2="17.5" stroke="#8b8775" strokeWidth="1.6" />
          <rect x="3" y="18" width="18" height="2.4" rx="0.6" fill="#4aa65c" />
        </svg>
      );

    case "police_military":
      return (
        <svg {...common}>
          {/* Tactical shield & star */}
          <path d="M12,3.2 L19.6,6.4 L19.6,12.2 C19.6,16.8 16.4,19.8 12,21.2 C7.6,19.8 4.4,16.8 4.4,12.2 L4.4,6.4 Z" fill="#2d5a9e" stroke="#18325c" strokeWidth="1.2" strokeLinejoin="round" />
          <polygon points="12,7.2 13.4,10.2 16.7,10.6 14.3,12.8 14.9,16 12,14.4 9.1,16 9.7,12.8 7.3,10.6 10.6,10.2" fill="#f7d154" />
        </svg>
      );

    case "landmarks_projects":
    default:
      return (
        <svg {...common}>
          {/* Golden pyramid / monument & star */}
          <polygon points="12,3.5 21,19.5 3,19.5" fill="#e6b94c" stroke="#8a6318" strokeWidth="1.2" strokeLinejoin="round" />
          <polygon points="12,3.5 21,19.5 14.8,19.5" fill="#c79632" />
          <circle cx="18.2" cy="6.2" r="2.1" fill="#5ce0c4" stroke="#18594c" strokeWidth="0.9" />
        </svg>
      );
  }
}

