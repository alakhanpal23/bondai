"""Regenerate research figures — Diamond Foundry register: ink, gray, one steel accent."""
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl

INK    = "#141519"   # diamond
OTHERS = "#e2e4e8"   # everyone else
STEEL  = "#6f8fa6"   # single accent (multiplier flags, fill)
LABEL  = "#8a8a90"
FAINT  = "#b8bcc2"
GRID   = "#edeef1"

mpl.rcParams.update({
    "font.family": ["Segoe UI", "DejaVu Sans"],
    "text.color": LABEL,
    "axes.edgecolor": GRID,
    "axes.labelcolor": LABEL,
    "xtick.color": LABEL,
    "ytick.color": FAINT,
    "axes.grid": True,
    "grid.color": GRID,
    "grid.linewidth": 0.8,
    "axes.axisbelow": True,
})

# ---------------- fig 1 : bar panels ----------------
mats = ["Si", "GaAs", "4H-SiC", "GaN", "Diamond"]
panels = [
    ("Bandgap", "eV",                 [1.12, 1.42, 3.26, 3.39, 5.47],  "4.9× Si"),
    ("Thermal conductivity", "W/m·K", [150, 55, 490, 130, 2400],  "16× Si"),
    ("Breakdown field", "MV/cm",      [0.3, 0.4, 2.8, 3.3, 10],        "33× Si"),
    ("Hole mobility", "cm²/V·s", [480, 400, 120, 200, 3800], "8× Si"),
]

fig, axes = plt.subplots(1, 4, figsize=(14.5, 4.0), dpi=200)
for ax, (title, unit, vals, mult) in zip(axes, panels):
    colors = [OTHERS] * 4 + [INK]
    bars = ax.bar(mats, vals, color=colors, width=0.56, zorder=3)
    ax.set_title(title, fontsize=11, color=INK, pad=16, loc="left", fontweight="medium")
    ax.text(0, 1.045, unit, transform=ax.transAxes, fontsize=7.5, color=FAINT, va="bottom")
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(axis="x", labelrotation=28, labelsize=8, length=0)
    ax.tick_params(axis="y", labelsize=7.5, length=0)
    ax.grid(axis="x", visible=False)
    top = max(vals)
    ax.set_ylim(0, top * 1.26)
    for b, v in zip(bars, vals):
        ax.annotate(f"{v:,g}", (b.get_x() + b.get_width()/2, v), ha="center",
                    va="bottom", fontsize=7.5, color=LABEL, xytext=(0, 3),
                    textcoords="offset points")
    db = bars[-1]
    ax.annotate(mult, (db.get_x() + db.get_width()/2, top * 1.03),
                ha="center", va="bottom", fontsize=10.5, color=STEEL,
                fontweight="bold", xytext=(0, 10), textcoords="offset points")
fig.tight_layout(w_pad=3.0)
fig.savefig(r"C:\Users\Arjun\diamond-site\assets\fig1.png",
            facecolor="white", bbox_inches="tight")
plt.close(fig)

# ---------------- fig 2 : radar ----------------
labels = ["Bandgap", "Breakdown\nfield", "Thermal\nconductivity",
          "Electron\nmobility", "Hole\nmobility", "Saturation\nvelocity"]
data = {
    "Diamond": [1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    "GaN":     [0.62, 0.33, 0.054, 0.27, 0.008, 0.93],
    "4H-SiC":  [0.60, 0.28, 0.204, 0.20, 0.032, 0.74],
    "Si":      [0.20, 0.03, 0.063, 0.31, 0.118, 0.37],
}
grays = {"Si": "#c3c7cd", "4H-SiC": "#a6abb3", "GaN": "#878d96"}

N = len(labels)
angles = np.linspace(0, 2*np.pi, N, endpoint=False).tolist()
angles += angles[:1]

fig = plt.figure(figsize=(7.4, 6.2), dpi=200)
ax = fig.add_subplot(111, polar=True)
ax.set_theta_offset(np.pi / 2)
ax.set_theta_direction(-1)
ax.set_ylim(0, 1.02)
ax.set_yticks([0.25, 0.5, 0.75, 1.0])
ax.set_yticklabels(["", "", "", "best in class"], fontsize=7.5, color=FAINT)
ax.set_xticks(angles[:-1])
ax.set_xticklabels(labels, fontsize=9.5, color=INK)
ax.grid(color=GRID, linewidth=0.9)
ax.spines["polar"].set_color(GRID)
ax.set_facecolor("white")

for name in ["Si", "4H-SiC", "GaN"]:
    vals = data[name] + data[name][:1]
    ax.plot(angles, vals, color=grays[name], linewidth=1.2, zorder=3)

vals = data["Diamond"] + data["Diamond"][:1]
ax.plot(angles, vals, color=INK, linewidth=2.4, zorder=5)
ax.fill(angles, vals, color=STEEL, alpha=0.13, zorder=4)

ax.legend(["Si", "4H-SiC", "GaN", "Diamond"], loc="upper right",
          bbox_to_anchor=(1.30, 1.06), fontsize=8.5, frameon=False,
          labelcolor=LABEL, handlelength=1.6)
fig.tight_layout()
fig.savefig(r"C:\Users\Arjun\diamond-site\assets\fig3.png",
            facecolor="white", bbox_inches="tight")
plt.close(fig)
print("figures written")
