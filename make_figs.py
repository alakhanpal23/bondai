"""Regenerate research figures in the KARA site palette."""
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl

STEEL   = "#3d76a6"   # diamond highlight (steel blue, final)
GRAY    = "#ccd0d6"   # other materials
INK     = "#0e0e10"
GRAPHITE= "#5f6166"
MUTED   = "#8a8a90"
LINE    = "#e9eaec"

mpl.rcParams.update({
    "font.family": ["Segoe UI", "DejaVu Sans"],
    "text.color": GRAPHITE,
    "axes.edgecolor": LINE,
    "axes.labelcolor": GRAPHITE,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "axes.grid": True,
    "grid.color": LINE,
    "grid.linewidth": 0.8,
    "axes.axisbelow": True,
    "svg.fonttype": "none",
})

# ---------------- fig 1 : bar panels ----------------
mats = ["Si", "GaAs", "4H-SiC", "GaN", "Diamond"]
panels = [
    ("Bandgap", "eV",              [1.12, 1.42, 3.26, 3.39, 5.47],  "4.9x Si"),
    ("Thermal conductivity", "W/m-K", [150, 55, 490, 130, 2400],    "16x Si"),
    ("Breakdown field", "MV/cm",   [0.3, 0.4, 2.8, 3.3, 10],        "33x Si"),
    ("Hole mobility", "cm2/V-s",   [480, 400, 120, 200, 3800],      "8x Si"),
]

fig, axes = plt.subplots(1, 4, figsize=(14.5, 4.1), dpi=200)
for ax, (title, unit, vals, mult) in zip(axes, panels):
    colors = [GRAY] * 4 + [STEEL]
    bars = ax.bar(mats, vals, color=colors, width=0.62, zorder=3)
    ax.set_title(title, fontsize=11.5, color=INK, pad=38, loc="left", fontweight="medium")
    ax.set_ylabel(unit, fontsize=9, labelpad=9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.tick_params(axis="x", labelrotation=35, labelsize=8.5, length=0)
    ax.tick_params(axis="y", labelsize=8)
    ax.grid(axis="x", visible=False)
    top = max(vals)
    ax.set_ylim(0, top * 1.42)
    for b, v in zip(bars, vals):
        ax.annotate(f"{v:,g}", (b.get_x() + b.get_width()/2, v), ha="center",
                    va="bottom", fontsize=8, color=GRAPHITE, xytext=(0, 3),
                    textcoords="offset points")
    # multiplier flag directly above the diamond bar's value label
    db = bars[-1]
    ax.annotate(mult.replace("x", "×"), (db.get_x() + db.get_width()/2, vals[-1]),
                ha="center", va="bottom", fontsize=10, color=STEEL, fontweight="bold",
                xytext=(0, 24), textcoords="offset points")
fig.tight_layout(w_pad=2.4)
fig.savefig(r"C:\Users\Arjun\diamond-site\assets\fig1.png",
            facecolor="white", bbox_inches="tight")
plt.close(fig)

# ---------------- fig 2 : radar ----------------
labels = ["Bandgap", "Breakdown\nfield", "Thermal\nconductivity",
          "Electron\nmobility", "Hole\nmobility", "Saturation\nvelocity"]
# normalized to class best
data = {
    "Diamond": [1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    "GaN":     [0.62, 0.33, 0.054, 0.27, 0.008, 0.93],
    "4H-SiC":  [0.60, 0.28, 0.204, 0.20, 0.032, 0.74],
    "Si":      [0.20, 0.03, 0.063, 0.31, 0.118, 0.37],
}
colors = {"Diamond": STEEL, "GaN": "#7d838c", "4H-SiC": "#a6abb3", "Si": "#c3c7cd"}

N = len(labels)
angles = np.linspace(0, 2*np.pi, N, endpoint=False).tolist()
angles += angles[:1]

fig = plt.figure(figsize=(7.4, 6.2), dpi=200)
ax = fig.add_subplot(111, polar=True)
ax.set_theta_offset(np.pi / 2)
ax.set_theta_direction(-1)
ax.set_ylim(0, 1.02)
ax.set_yticks([0.25, 0.5, 0.75, 1.0])
ax.set_yticklabels(["25%", "50%", "75%", "best"], fontsize=7.5, color=MUTED)
ax.set_xticks(angles[:-1])
ax.set_xticklabels(labels, fontsize=9.5, color=INK)
ax.grid(color=LINE, linewidth=0.9)
ax.spines["polar"].set_color(LINE)

for name in ["Si", "4H-SiC", "GaN", "Diamond"]:
    vals = data[name] + data[name][:1]
    if name == "Diamond":
        ax.plot(angles, vals, color=colors[name], linewidth=2.6, zorder=5)
        ax.fill(angles, vals, color=colors[name], alpha=0.16, zorder=4)
    else:
        ax.plot(angles, vals, color=colors[name], linewidth=1.3, zorder=3)

ax.legend(["Si", "4H-SiC", "GaN", "Diamond"], loc="upper right",
          bbox_to_anchor=(1.28, 1.08), fontsize=9, frameon=False,
          labelcolor=GRAPHITE)
fig.tight_layout()
fig.savefig(r"C:\Users\Arjun\diamond-site\assets\fig3.png",
            facecolor="white", bbox_inches="tight")
plt.close(fig)
print("figures written")

