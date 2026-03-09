const cds = require("@sap/cds");

module.exports = cds.service.impl(function () {
  const { MaterialShelfLife } = this.entities;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  this.after("READ", MaterialShelfLife, (rows) => {
    const data = Array.isArray(rows) ? rows : [rows];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const r of data) {
      // Guard required fields
      if (!r || !r.VFDAT || !r.HSDAT) {
        r.RemainingDays = null;
        r.Status = "Red";
        r.Criticality = 1;
        r.RemainingPct = null;
        continue;
      }

      const exp = new Date(r.VFDAT);  // VFDAT: expiration date
      exp.setHours(0, 0, 0, 0);

      const mfg = new Date(r.HSDAT);  // HSDAT: manufacture date
      mfg.setHours(0, 0, 0, 0);

      // Exposure hours (EXDAT). If missing, assume 0.
      const exposureHrs = r.EXDAT != null ? Number(r.EXDAT) : 0;
      const exposureDays = exposureHrs / 24;

      // Total usable shelf life (days): (VFDAT - HSDAT) - EXDAT(hours)
      const totalDaysRaw = Math.ceil((exp - mfg) / MS_PER_DAY);
      const totalUsableDays = totalDaysRaw - exposureDays;

      // Remaining usable shelf life (days): (VFDAT - today) - EXDAT(hours)
      const remainingDaysRaw = Math.ceil((exp - today) / MS_PER_DAY);
      const remainingUsableDays = remainingDaysRaw - exposureDays;

      // Clamp to sensible bounds
      const safeTotal = Math.max(0, totalUsableDays);
      const safeRemaining = Math.max(0, remainingUsableDays);

      r.RemainingDays = Math.round(safeRemaining); // keep integer for table/UI

      // Remaining percentage (avoid divide by zero)
      const remainingPct = safeTotal > 0 ? (safeRemaining / safeTotal) * 100 : 0;
      r.RemainingPct = Math.max(0, Math.min(100, Number(remainingPct.toFixed(2))));

      // Status rules:
      // Green >= 75%
      // Yellow >= 30%
      // Red < 30% OR expired/invalid
      if (r.RemainingDays <= 0 || safeTotal <= 0) {
        r.Status = "Red";
        r.Criticality = 1;
      } else if (r.RemainingPct >= 75) {
        r.Status = "Green";
        r.Criticality = 3;
      } else if (r.RemainingPct >= 30) {
        r.Status = "Yellow";
        r.Criticality = 2;
      } else {
        r.Status = "Red";
        r.Criticality = 1;
      }
    }
  });
});