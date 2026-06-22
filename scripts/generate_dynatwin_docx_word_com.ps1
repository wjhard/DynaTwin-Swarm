param(
    [string]$SourcePath = "docs\dynatwin_word_com_source.md",
    [string]$OutputPath = "DynaTwin-Swarm-technical-document.docx"
)

$ErrorActionPreference = "Stop"

function Convert-CmToPt([double]$cm) {
    return $cm / 2.54 * 72.0
}

function Convert-HexToOleColor([string]$hex) {
    $clean = $hex.TrimStart("#")
    $r = [Convert]::ToInt32($clean.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($clean.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($clean.Substring(4, 2), 16)
    return $r + ($g * 256) + ($b * 65536)
}

$wdFormatXMLDocument = 16
$wdPaperA4 = 7
$wdPageBreak = 7
$wdStyleNormal = -1
$wdStyleTitle = -63
$wdStyleHeading1 = -2
$wdStyleHeading2 = -3
$wdStyleHeading3 = -4
$wdAlignParagraphLeft = 0
$wdAlignParagraphCenter = 1
$wdLineSpace1pt5 = 1
$wdBorderBottom = -3
$wdLineStyleSingle = 1
$wdAutoFitWindow = 2
$wdStatisticPages = 2
$wdColorWhite = 16777215
$msoTextOrientationHorizontal = 1

$fontName = -join ([char]0x5B8B, [char]0x4F53)
$tocTitle = -join ([char]0x76EE, [char]0x5F55)
$headerTitle = "DynaTwin-Swarm" + (-join ([char]0x9879, [char]0x76EE, [char]0x6280, [char]0x672F, [char]0x6587, [char]0x6863))
$darkBlue = Convert-HexToOleColor "#0B3A70"
$blue = Convert-HexToOleColor "#1D5FA7"
$lightBlue = Convert-HexToOleColor "#DCEBFA"
$tableBlue = Convert-HexToOleColor "#1D5FA7"
$grayFill = Convert-HexToOleColor "#E8E8E8"
$grayLine = Convert-HexToOleColor "#A0A0A0"
$grayText = Convert-HexToOleColor "#666666"

$root = (Resolve-Path ".").Path
$sourceFullPath = Join-Path $root $SourcePath
$outputFullPath = Join-Path $root $OutputPath

if (-not (Test-Path $sourceFullPath)) {
    throw "Source file not found: $sourceFullPath"
}

$lines = Get-Content -LiteralPath $sourceFullPath -Encoding UTF8
$tocEntries = @()
foreach ($sourceLine in $lines) {
    $trimmedSourceLine = $sourceLine.Trim()
    if ($trimmedSourceLine.StartsWith("# ")) {
        $tocEntries += $trimmedSourceLine.Substring(2).Trim()
    }
}

$word = $null
$doc = $null

function Release-ComObject($obj) {
    if ($null -ne $obj) {
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj)
    }
}

function Get-EndRange {
    return $doc.Range($doc.Content.End - 1, $doc.Content.End - 1)
}

function Set-CommonFont($range, [double]$size = 12, [bool]$bold = $false, $color = $null) {
    $range.Font.Name = $fontName
    $range.Font.NameFarEast = $fontName
    $range.Font.Size = $size
    $range.Font.Bold = $(if ($bold) { 1 } else { 0 })
    if ($null -ne $color) {
        $range.Font.Color = $color
    }
}

function Add-Paragraph([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $boldPrefix = $null
    if ($text -match '^\*\*(.+?)\*\*(.*)$') {
        $boldPrefix = $matches[1]
        $text = $matches[1] + $matches[2]
    }
    $range = Get-EndRange
    $range.InsertAfter($text + "`r")
    $p = $doc.Paragraphs.Item($doc.Paragraphs.Count).Range
    $p.Style = $wdStyleNormal
    Set-CommonFont $p 12 $false $null
    if ($null -ne $boldPrefix) {
        try {
            $boldEnd = [Math]::Min($p.Start + $boldPrefix.Length, $p.End - 1)
            if ($boldEnd -gt $p.Start) {
                $boldRange = $doc.Range($p.Start, $boldEnd)
                $boldRange.Font.Bold = 1
                Release-ComObject $boldRange
            }
        }
        catch {}
    }
    $p.ParagraphFormat.Alignment = $wdAlignParagraphLeft
    $p.ParagraphFormat.FirstLineIndent = 24
    $p.ParagraphFormat.LineSpacingRule = $wdLineSpace1pt5
    $p.ParagraphFormat.SpaceAfter = 6
}

function Add-CenteredParagraph([string]$text, [double]$size = 12, [bool]$bold = $false, $color = $null) {
    $range = Get-EndRange
    $range.InsertAfter($text + "`r")
    $p = $doc.Paragraphs.Item($doc.Paragraphs.Count).Range
    Set-CommonFont $p $size $bold $color
    $p.ParagraphFormat.Alignment = $wdAlignParagraphCenter
    $p.ParagraphFormat.FirstLineIndent = 0
    $p.ParagraphFormat.LineSpacingRule = $wdLineSpace1pt5
    $p.ParagraphFormat.SpaceAfter = 10
}

function Add-Heading1([string]$text) {
    $range = Get-EndRange
    $range.InsertAfter($text + "`r")
    $p = $doc.Paragraphs.Item($doc.Paragraphs.Count).Range
    $p.Style = $wdStyleHeading1
    Set-CommonFont $p 16 $true $darkBlue
    $p.ParagraphFormat.FirstLineIndent = 0
    $p.ParagraphFormat.LineSpacingRule = $wdLineSpace1pt5
    $p.ParagraphFormat.SpaceBefore = 10
    $p.ParagraphFormat.SpaceAfter = 8
    $border = $p.ParagraphFormat.Borders.Item($wdBorderBottom)
    $border.LineStyle = $wdLineStyleSingle
    $border.Color = $blue
}

function Add-Heading2([string]$text) {
    $range = Get-EndRange
    $range.InsertAfter($text + "`r")
    $p = $doc.Paragraphs.Item($doc.Paragraphs.Count).Range
    $p.Style = $wdStyleHeading2
    Set-CommonFont $p 14 $true $blue
    $p.ParagraphFormat.FirstLineIndent = 0
    $p.ParagraphFormat.LineSpacingRule = $wdLineSpace1pt5
    $p.ParagraphFormat.SpaceBefore = 8
    $p.ParagraphFormat.SpaceAfter = 6
}

function Add-Heading3([string]$text) {
    $range = Get-EndRange
    $range.InsertAfter($text + "`r")
    $p = $doc.Paragraphs.Item($doc.Paragraphs.Count).Range
    $p.Style = $wdStyleHeading3
    Set-CommonFont $p 13 $true $null
    $p.ParagraphFormat.FirstLineIndent = 0
    $p.ParagraphFormat.LineSpacingRule = $wdLineSpace1pt5
    $p.ParagraphFormat.SpaceBefore = 6
    $p.ParagraphFormat.SpaceAfter = 4
}

function Add-PageBreak {
    $range = Get-EndRange
    $range.InsertBreak($wdPageBreak)
}

function Add-Placeholder([string]$text) {
    $tableRange = Get-EndRange
    $table = $doc.Tables.Add($tableRange, 1, 1)
    $table.PreferredWidth = Convert-CmToPt 14
    $table.Borders.Enable = 1
    $table.Cell(1,1).Range.Text = $text
    $table.Cell(1,1).Shading.BackgroundPatternColor = $grayFill
    $table.Cell(1,1).Range.Font.Color = $grayText
    $table.Cell(1,1).Range.Font.NameFarEast = $fontName
    $table.Cell(1,1).Range.Font.Size = 12
    $table.Cell(1,1).Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter
    $table.Rows.Item(1).Height = Convert-CmToPt 4.2
    $table.Range.InsertParagraphAfter()
    Release-ComObject $table
}

function Add-MarkdownTable($tableLines) {
    $rows = @()
    foreach ($line in $tableLines) {
        if ($line -match "^\s*\|?\s*:?-{3,}") { continue }
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith("|")) { $trimmed = $trimmed.Substring(1) }
        if ($trimmed.EndsWith("|")) { $trimmed = $trimmed.Substring(0, $trimmed.Length - 1) }
        $cells = @($trimmed -split "\|" | ForEach-Object { $_.Trim() })
        if ($cells.Count -gt 0) { $rows += ,$cells }
    }
    if ($rows.Count -eq 0) { return }

    $colCount = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
    $range = Get-EndRange
    $table = $doc.Tables.Add($range, $rows.Count, $colCount)
    $table.AutoFitBehavior($wdAutoFitWindow)
    $table.Borders.Enable = 1
    for ($r = 0; $r -lt $rows.Count; $r++) {
        for ($c = 0; $c -lt $colCount; $c++) {
            $value = ""
            if ($c -lt $rows[$r].Count) { $value = $rows[$r][$c] }
            $cellRange = $table.Cell($r + 1, $c + 1).Range
            $cellRange.Text = $value
            Set-CommonFont $cellRange 10 $false $null
            $cellRange.ParagraphFormat.FirstLineIndent = 0
            $cellRange.ParagraphFormat.LineSpacingRule = $wdLineSpace1pt5
            if ($r -eq 0) {
                $cellRange.Font.Bold = 1
                $cellRange.Font.Color = $wdColorWhite
                $table.Cell($r + 1, $c + 1).Shading.BackgroundPatternColor = $tableBlue
            }
            elseif (($r % 2) -eq 0) {
                $table.Cell($r + 1, $c + 1).Shading.BackgroundPatternColor = $lightBlue
            }
        }
    }
    $table.Range.InsertParagraphAfter()
    Release-ComObject $table
}

function Add-TableOfContents {
    Add-Heading1 $tocTitle
    foreach ($entry in $tocEntries) {
        Add-Paragraph $entry
    }
}

try {
    try {
        $word = New-Object -ComObject Word.Application
    }
    catch {
        $word = New-Object -ComObject Kwps.Application
    }
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Add()

    $section = $doc.Sections.Item(1)
    $section.PageSetup.PaperSize = $wdPaperA4
    $section.PageSetup.TopMargin = Convert-CmToPt 2.54
    $section.PageSetup.BottomMargin = Convert-CmToPt 2.54
    $section.PageSetup.LeftMargin = Convert-CmToPt 3.17
    $section.PageSetup.RightMargin = Convert-CmToPt 3.17

    $normalStyle = $doc.Styles.Item($wdStyleNormal)
    $normalStyle.Font.Name = $fontName
    $normalStyle.Font.NameFarEast = $fontName
    $normalStyle.Font.Size = 12
    $normalStyle.ParagraphFormat.FirstLineIndent = 24
    $normalStyle.ParagraphFormat.LineSpacingRule = $wdLineSpace1pt5

    $header = $section.Headers.Item(1)
    $header.Range.Text = $headerTitle
    Set-CommonFont $header.Range 10 $false $darkBlue
    $header.Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter

    $footer = $section.Footers.Item(1)
    Set-CommonFont $footer.Range 10 $false $grayText
    $footer.Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter
    $null = $footer.PageNumbers.Add()

    $i = 0
    while ($i -lt $lines.Count) {
        $line = $lines[$i].TrimEnd()

        if ([string]::IsNullOrWhiteSpace($line)) {
            $i++
            continue
        }

        if ($line -eq "[COVER]") {
            $coverLines = @()
            $i++
            while ($i -lt $lines.Count -and $lines[$i].Trim() -ne "[ENDCOVER]") {
                if (-not [string]::IsNullOrWhiteSpace($lines[$i])) {
                    $coverLines += $lines[$i].Trim()
                }
                $i++
            }
            if ($coverLines.Count -gt 0) {
                Add-CenteredParagraph $coverLines[0] 24 $true $darkBlue
                for ($j = 1; $j -lt $coverLines.Count; $j++) {
                    if ($j -eq 1) {
                        Add-CenteredParagraph $coverLines[$j] 16 $true $blue
                    }
                    else {
                        Add-CenteredParagraph $coverLines[$j] 12 $false $null
                    }
                }
            }
            Add-PageBreak
            $i++
            continue
        }

        if ($line -eq "[TOC]") {
            Add-TableOfContents
            Add-PageBreak
            $i++
            continue
        }

        if ($line -eq "[PAGEBREAK]") {
            Add-PageBreak
            $i++
            continue
        }

        if ($line -match "^\[PLACEHOLDER:(.*)\]$") {
            Add-Placeholder $matches[1].Trim()
            $i++
            continue
        }

        if ($line.TrimStart().StartsWith("|")) {
            $tableLines = @()
            while ($i -lt $lines.Count -and $lines[$i].TrimStart().StartsWith("|")) {
                $tableLines += $lines[$i]
                $i++
            }
            Add-MarkdownTable $tableLines
            continue
        }

        if ($line.StartsWith("### ")) {
            Add-Heading3 $line.Substring(4).Trim()
        }
        elseif ($line.StartsWith("## ")) {
            Add-Heading2 $line.Substring(3).Trim()
        }
        elseif ($line.StartsWith("# ")) {
            Add-Heading1 $line.Substring(2).Trim()
        }
        else {
            Add-Paragraph $line
        }
        $i++
    }

    try { $null = $doc.ComputeStatistics($wdStatisticPages) } catch {}
    [string]$savePath = $outputFullPath
    [int]$saveFormat = $wdFormatXMLDocument
    $doc.SaveAs([ref]$savePath, [ref]$saveFormat)
    Write-Output $outputFullPath
}
finally {
    if ($null -ne $doc) {
        try { $doc.Close($false) | Out-Null } catch {}
        Release-ComObject $doc
    }
    if ($null -ne $word) {
        try { $word.Quit() | Out-Null } catch {}
        Release-ComObject $word
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
