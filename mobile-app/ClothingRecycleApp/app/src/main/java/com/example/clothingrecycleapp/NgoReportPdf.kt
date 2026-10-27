package com.example.clothingrecycleapp

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object NgoReportPdf {

    fun create(report: NgoDonationReportResponse): ByteArray {
        val document = PdfDocument()

        val pageWidth = 595
        val pageHeight = 842
        val margin = 40f
        val bottomMargin = 45f

        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 10f
            color = android.graphics.Color.DKGRAY
        }

        val headingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 19f
            color = android.graphics.Color.rgb(32, 92, 61)
            typeface = Typeface.create(
                Typeface.DEFAULT,
                Typeface.BOLD
            )
        }

        val boldPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 11f
            color = android.graphics.Color.rgb(32, 92, 61)
            typeface = Typeface.create(
                Typeface.DEFAULT,
                Typeface.BOLD
            )
        }

        val smallPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 9f
            color = android.graphics.Color.DKGRAY
        }

        val lines = mutableListOf<Pair<String, Int>>()

        // Report heading
        lines.add("NGO Donation Activity Report" to 1)
        lines.add(report.centre.name to 2)

        if (!report.centre.address.isNullOrBlank()) {
            lines.add(report.centre.address!! to 3)
        }

        val generatedDate = report.generatedAt
            ?.replace('T', ' ')
            ?.take(19)
            ?: SimpleDateFormat(
                "yyyy-MM-dd HH:mm",
                Locale.getDefault()
            ).format(Date())

        lines.add("Generated: $generatedDate" to 3)
        lines.add("" to 0)

        // Summary
        lines.add("DONATION SUMMARY" to 2)
        lines.add(
            "Total donation records: ${report.summary.totalDonations}" to 0
        )
        lines.add(
            "Verified donations: ${report.summary.verifiedDonations}" to 0
        )
        lines.add(
            "Pending donations: ${report.summary.pendingDonations}" to 0
        )
        lines.add(
            "Items in verified donations: ${report.summary.totalItems}" to 0
        )
        lines.add(
            "Reward points awarded: ${report.summary.totalPoints}" to 0
        )

        lines.add("" to 0)
        lines.add("DONATION RECORDS" to 2)

        if (report.donations.isEmpty()) {
            lines.add("No donation records found." to 0)
        } else {
            report.donations.forEachIndexed { index, donation ->

                val date = (
                        donation.verifiedAt ?: donation.createdAt
                        )?.take(10) ?: "Date unavailable"

                val status = when (donation.status) {
                    "verified" -> "Verified"
                    "awaiting_verification" ->
                        "Pending verification"
                    else -> donation.status.replace('_', ' ')
                }

                lines.add(
                    "${index + 1}. $date | $status" to 2
                )
                lines.add(
                    "   Donor: ${donation.donorName}" to 0
                )
                lines.add(
                    "   Items: ${donation.itemCount} | " +
                            "Points: ${donation.totalPoints}" to 0
                )
                lines.add("" to 0)
            }
        }

        lines.add(
            "This report contains records for this NGO's linked donation centre only." to 3
        )

        var pageNumber = 1
        var lineIndex = 0

        while (lineIndex < lines.size) {
            val pageInfo = PdfDocument.PageInfo.Builder(
                pageWidth,
                pageHeight,
                pageNumber
            ).create()

            val page = document.startPage(pageInfo)
            val canvas = page.canvas

            var y = 48f

            while (
                lineIndex < lines.size &&
                y < pageHeight - bottomMargin
            ) {
                val (text, style) = lines[lineIndex]

                val paint = when (style) {
                    1 -> headingPaint
                    2 -> boldPaint
                    3 -> smallPaint
                    else -> bodyPaint
                }

                val wrappedLines = wrap(
                    text,
                    paint,
                    pageWidth - margin * 2
                )

                for (part in wrappedLines) {
                    if (y >= pageHeight - bottomMargin) {
                        break
                    }

                    canvas.drawText(part, margin, y, paint)
                    y += if (style == 1) 27f else 18f
                }

                lineIndex++
            }

            canvas.drawText(
                "Page $pageNumber",
                pageWidth - margin - 45f,
                pageHeight - 20f,
                smallPaint
            )

            document.finishPage(page)
            pageNumber++
        }

        val output = ByteArrayOutputStream()

        try {
            document.writeTo(output)
            return output.toByteArray()
        } finally {
            document.close()
        }
    }

    private fun wrap(
        text: String,
        paint: Paint,
        maxWidth: Float
    ): List<String> {
        if (text.isEmpty()) return listOf("")

        val result = mutableListOf<String>()
        var current = ""

        for (word in text.split(Regex("\\s+"))) {
            val candidate = if (current.isEmpty()) {
                word
            } else {
                "$current $word"
            }

            if (
                paint.measureText(candidate) <= maxWidth ||
                current.isEmpty()
            ) {
                current = candidate
            } else {
                result.add(current)
                current = word
            }
        }

        if (current.isNotEmpty()) {
            result.add(current)
        }

        return result
    }
}