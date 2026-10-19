import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function formatCo2(kg) {
  return kg >= 1000
    ? `${(kg / 1000).toFixed(2)} tonnes CO2e`
    : `${kg.toFixed(1)} kg CO2e`
}

export function exportAnalyticsPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = 50

  function heading(text) {
    y += 26
    if (y > 760) {
      doc.addPage()
      y = 50
    }
    doc.setFontSize(13)
    doc.setTextColor(20, 83, 45)
    doc.text(text, margin, y)
    y += 8
  }

  function table(head, body) {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 101, 52] },
    })
    y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y + 20 * (body.length + 1)) + 4
  }

  doc.setFontSize(18)
  doc.setTextColor(20, 83, 45)
  doc.text('EcoThread - Verification & Analytics report', margin, y)

  y += 18
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Generated ${new Date(data.generatedAt).toLocaleString()}`, margin, y)

  // Carbon
  const c = data.carbon
  heading('Carbon offset (estimate)')
  table(
    ['This month', 'Last month', 'Change', 'Items donated this month'],
    [[
      formatCo2(c.thisMonthKg),
      formatCo2(c.lastMonthKg),
      c.changePct === null ? 'n/a' : `${c.changePct > 0 ? '+' : ''}${c.changePct}%`,
      String(c.thisMonthItems),
    ]]
  )
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(
    `Estimate = verified items x ${c.assumptions.avgItemWeightKg} kg average item weight x ${c.assumptions.co2ePerKg} kg CO2e per kg reused.`,
    margin,
    y + 8
  )
  y += 12

  // Centre ranking
  heading(`Top centres by verified donations (last ${data.centres.days === 1 ? '24 hours' : `${data.centres.days} days`})`)
  table(
    ['Rank', 'Centre', 'Verified donations', 'Items'],
    data.centres.list.length
      ? data.centres.list.map((c, i) => [String(i + 1), c.name, String(c.donations), String(c.items)])
      : [['', 'No verified donations in this period', '', '']]
  )

  // Partner performance
  heading('Partner performance (last 7 days)')
  table(
    ['Day', 'Verified donations', 'Items'],
    data.performance.perDay.map((d) => [d.day, String(d.donations), String(d.items)])
  )
  y += 10
  table(
    ['Partner / centre', 'Donations', 'Items', 'Points issued'],
    data.performance.partners.length
      ? data.performance.partners.map((p) => [p.name, String(p.donations), String(p.items), String(p.points)])
      : [['No verified donations in the last 7 days', '', '', '']]
  )

  // Recent activity
  heading('Recent impact activities')
  table(
    ['Code', 'Centre', 'Donor', 'Items', 'Status', 'Points', 'When'],
    data.recent.length
      ? data.recent.map((r) => [
          r.code,
          r.centre,
          r.donor,
          String(r.items),
          r.status === 'verified' ? 'Verified' : 'Pending',
          String(r.points),
          new Date(r.when).toLocaleDateString(),
        ])
      : [['No donations yet', '', '', '', '', '', '']]
  )

  doc.save(`ecothread-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}