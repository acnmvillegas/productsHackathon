
const cds = require('@sap/cds');

module.exports = cds.service.impl(function () {
  const { MaterialShelfLife } = this.entities;

  // Configurable thresholds for MVP
  const WARNING_BUFFER_DAYS = 30; // Yellow Window above MHDRZ (tune as needed)

  this.after('READ', MaterialShelfLife, (rows) => {
    const data = Array.isArray(rows) ? rows : [rows];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const r of data) {
      // Guard nulls
      if (!r || !r.VFDAT) {
        r.RemainingDays = null;
        r.Status = 'Red';
        r.Criticality = 1;
        continue;
      }

      const exp = new Date(r.VFDAT);
      exp.setHours(0, 0, 0, 0);

      const remainingDays = Math.ceil((exp - today) / (24 * 60 * 60 * 1000));
      r.RemainingDays = remainingDays;

      const minRemaining = r.MHDRZ != null ? Number(r.MHDRZ) : 0;

      // Suggested criticality rules (simple + effective for hackathon):
      // Red: expired OR below minimum remaining shelf life
      // Yellow: within (minRemaining + buffer)
      // Green: otherwise
      if (remainingDays <= 0 || remainingDays < minRemaining) {
        r.Status = 'Red';
        r.Criticality = 1;
      } else if (remainingDays <= (minRemaining + WARNING_BUFFER_DAYS)) {
        r.Status = 'Yellow';
        r.Criticality = 2;
      } else {
        r.Status = 'Green';
        r.Criticality = 3;
      }
    }
  });
});