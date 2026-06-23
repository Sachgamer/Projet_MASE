import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from django.conf import settings

def remove_emojis(text):
    if not text:
        return ""
    cleaned = []
    for char in text:
        try:
            # ReportLab standard Helvetica supports cp1252 (WinAnsiEncoding)
            char.encode('cp1252')
            code = ord(char)
            # Remove emojis and high range symbols
            if code > 0xFFFF or (0x2300 <= code <= 0x27BF) or (0x2B00 <= code <= 0x2BFF):
                continue
            cleaned.append(char)
        except UnicodeEncodeError:
            continue
    return "".join(cleaned)

def wrap_text(text, max_chars=85):
    if not text:
        return []
    words = text.split(' ')
    lines = []
    current_line = []
    current_len = 0
    for word in words:
        if current_len + len(word) + 1 > max_chars:
            lines.append(" ".join(current_line))
            current_line = [word]
            current_len = len(word)
        else:
            current_line.append(word)
            current_len += len(word) + 1
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def generate_accident_pdf(report):
    # 1. Préparation calque
    overlay_buffer = BytesIO()
    c = canvas.Canvas(overlay_buffer, pagesize=A4)
    
    # A4 est environ 595 x 842
    c.setFont("Helvetica", 10)
    
    # 2. Remplissage des informations du haut
    # Nom du déclarant (personne)
    reporter_name = f"{report.reporter.first_name} {report.reporter.last_name}".strip() or report.reporter.username
    c.drawString(175, 648, remove_emojis(reporter_name))
    
    # Date de l'incident
    from django.utils import timezone
    local_date = timezone.localtime(report.incident_date) if report.incident_date else timezone.localtime()
    date_str = local_date.strftime("%d/%m/%Y à %H:%M")
    c.drawString(140, 615, date_str)
    
    # Lieu de l'incident
    c.drawString(130, 583, remove_emojis(report.location))
    
    # 3. Description dans un cadre (x=35, y=360, width=525, height=165)
    c.setStrokeColor(colors.HexColor('#CCCCCC'))
    c.setLineWidth(1)
    c.roundRect(35, 360, 525, 165, 4, stroke=1, fill=0)
    
    # Texte de la description
    description_lines = wrap_text(report.description, max_chars=90)
    y_text = 510
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.black)
    for line in description_lines[:12]:  # Limiter le nombre de lignes pour ne pas déborder du cadre
        c.drawString(45, y_text, remove_emojis(line))
        y_text -= 12
        
    # 4. Photos (en dessous)
    if report.image:
        try:
            img_path = report.image.path
            if os.path.exists(img_path):
                # On dessine la photo dans la zone y=175 à y=325
                c.drawImage(img_path, 45, 175, width=250, height=150, preserveAspectRatio=True)
        except Exception:
            # En cas d'erreur de chargement d'image
            c.setStrokeColor(colors.red)
            c.rect(45, 175, 250, 150, stroke=1, fill=0)
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(colors.red)
            c.drawCentredString(170, 255, "Image corrompue ou non supportée")
            c.setFillColor(colors.black)
            
    # 5. Signature
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(40, 100, f"Signé par : {remove_emojis(reporter_name)}")
    
    c.save()
    overlay_buffer.seek(0)
    
    # 6. Fusion avec le template
    template_path = os.path.join(settings.BASE_DIR, "templates", "pdf", "accident_template.pdf")
    
    if not os.path.exists(template_path):
        overlay_buffer.seek(0)
        return overlay_buffer
        
    reader = PdfReader(template_path)
    writer = PdfWriter()
    
    page = reader.pages[0]
    overlay_reader = PdfReader(overlay_buffer)
    overlay_page = overlay_reader.pages[0]
    page.merge_page(overlay_page)
    
    writer.add_page(page)
    
    final_buffer = BytesIO()
    writer.write(final_buffer)
    final_buffer.seek(0)
    
    return final_buffer
