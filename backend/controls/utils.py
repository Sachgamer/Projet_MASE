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

def generate_inspection_pdf(inspection):
    # 1. preparation calque
    overlay_buffer = BytesIO()
    c = canvas.Canvas(overlay_buffer, pagesize=A4)
    
    # ref pixel feuille a4
    # A4 est environ 595 x 842 pixels
    
    # police
    c.setFont("Helvetica", 10)
    
    # Nom tech
    raw_name = f"{inspection.item.technician.first_name} {inspection.item.technician.last_name}"
    name = remove_emojis(raw_name)
    
    # Date
    from django.utils import timezone
    local_date = timezone.localtime(inspection.date) if inspection.date else timezone.localtime()
    date_str = local_date.strftime("%d/%m/%Y %H:%M")
    
    is_vehicule = (inspection.item.category == 'VEHICULE')
    
    if is_vehicule:
        c.drawString(180, 667, name)
        c.drawString(130, 647, date_str)
        
        # Check technique du véhicule
        if inspection.vehicle_checks:
            checks_y = {
                'Feux (Avant/Arrière/Signalisation)': 606,
                'Carrosserie': 591,
                'Propreté (Intérieur/Extérieur)': 575,
                'Documents techniques présents': 560,
                'État des pneus': 545,
                'Niveaux (Huile/Liquide de refroidissement)': 529,
                'Freins': 514
            }
            for check_name, y_pos in checks_y.items():
                val = inspection.vehicle_checks.get(check_name)
                if val is True:
                    c.setFillColor(colors.green)
                    c.drawString(250, y_pos, "Valide")
                elif val is False:
                    c.setFillColor(colors.red)
                    c.drawString(250, y_pos, "Non Valide")
                c.setFillColor(colors.black)
                
        # 3. Tableau
        y_table = 455 
        c.drawCentredString(67, y_table, remove_emojis(inspection.item.get_category_display())) # Type
        c.drawCentredString(130, y_table, remove_emojis(inspection.item.serial_number or "N/A")) # S/N
        c.drawCentredString(321, y_table, remove_emojis(inspection.item.type_name)) # Désignation
        
        # Contrôle
        c.setFont("Helvetica", 8)
        c.drawCentredString(520, y_table, "CONFORME" if inspection.is_valid else "NON CONFORME")
        c.setFont("Helvetica", 10) 
        
        # 4. Photos
        photos = inspection.photos.all()
        if photos.exists():
            for idx, photo_obj in enumerate(photos[:3]): 
                img_path = photo_obj.image.path
                if os.path.exists(img_path):
                    x_pos = 40 + (idx * 160)
                    y_pos = 280
                    try:
                        c.drawImage(img_path, x_pos, y_pos, width=150, height=100, preserveAspectRatio=True)
                    except Exception:
                        c.setStrokeColor(colors.red)
                        c.rect(x_pos, y_pos, 150, 100, stroke=1, fill=0)
                        c.setFont("Helvetica-Bold", 8)
                        c.setFillColor(colors.red)
                        c.drawCentredString(x_pos + 75, y_pos + 55, "Image corrompue")
                        c.drawCentredString(x_pos + 75, y_pos + 40, "ou non supportée")
                        c.setFillColor(colors.black)
                        c.setFont("Helvetica", 10)
    
        # 5. Commentaire
        if inspection.comments:
            c.drawString(45, 220, remove_emojis(inspection.comments[:1000])) 
            
        # 6. Signatures 
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(40, 100, f"Technicien: {name}")
    else:
        # EPI ou EQUIPEMENT (controle_template.pdf)
        c.drawString(180, 665.8, name)
        c.drawString(130, 632.7, date_str)
        
        # Expiration date
        exp_date = inspection.item.expiration_date
        exp_date_str = exp_date.strftime("%d/%m/%Y") if exp_date else "N/A"
        c.drawString(200, 611.7, exp_date_str)
        
        # Table content at y=560
        c.drawCentredString(74.7, 560, remove_emojis(inspection.item.get_category_display()))
        
        designation_sn = f"{inspection.item.type_name} (S/N: {inspection.item.serial_number or 'N/A'})"
        c.drawCentredString(322.4, 560, remove_emojis(designation_sn))
        
        # Contrôle status at x=500
        c.setFont("Helvetica-Bold", 10)
        if inspection.is_valid:
            c.setFillColor(colors.green)
            c.drawCentredString(500, 560, "CONFORME")
        else:
            c.setFillColor(colors.red)
            c.drawCentredString(500, 560, "NON CONFORME")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        
        # Defects checklist
        # Check if EQUIPEMENT to mask labels
        if inspection.item.category == 'EQUIPEMENT':
            c.setFillColor(colors.white)
            # Cover Trou (y=499.1)
            c.rect(30, 493, 150, 15, fill=True, stroke=False)
            # Cover Déchirure (y=468.9)
            c.rect(30, 463, 150, 15, fill=True, stroke=False)
            # Cover Cassé (y=438.7)
            c.rect(30, 433, 150, 15, fill=True, stroke=False)
            
            c.setFillColor(colors.black)
            c.drawString(35.1, 499.1, "Dysfonctionnement :")
            c.drawString(35.1, 468.9, "HS :")
            c.drawString(35.1, 438.7, "Altéré :")
            
            # Values mapping
            defects_to_check = [
                ('Dysfonctionnement', 499.1),
                ('HS', 468.9),
                ('Altéré', 438.7)
            ]
        else:
            # EPI
            defects_to_check = [
                ('Trou', 499.1),
                ('Déchirure', 468.9),
                ('Cassé', 438.7)
            ]
            
        # Draw status for each defect
        for defect_name, y_pos in defects_to_check:
            is_defective = inspection.defects.get(defect_name, False)
            if is_defective:
                c.setFillColor(colors.red)
                c.drawString(250, y_pos, "NON CONFORME")
            else:
                c.setFillColor(colors.green)
                c.drawString(250, y_pos, "CONFORME")
            c.setFillColor(colors.black)
            
        # Handle optional Absent defect warning
        if inspection.item.category == 'EPI' and inspection.defects.get('Absent', False):
            c.setFillColor(colors.red)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(35.1, 418, "ATTENTION : Équipement signalé comme ABSENT")
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 10)
            
        # Photos
        photos = inspection.photos.all()
        if photos.exists():
            for idx, photo_obj in enumerate(photos[:3]): 
                img_path = photo_obj.image.path
                if os.path.exists(img_path):
                    x_pos = 40 + (idx * 160)
                    y_pos = 315
                    try:
                        c.drawImage(img_path, x_pos, y_pos, width=120, height=80, preserveAspectRatio=True)
                    except Exception:
                        c.setStrokeColor(colors.red)
                        c.rect(x_pos, y_pos, 120, 80, stroke=1, fill=0)
                        c.setFont("Helvetica-Bold", 8)
                        c.setFillColor(colors.red)
                        c.drawCentredString(x_pos + 60, y_pos + 45, "Image corrompue")
                        c.drawCentredString(x_pos + 60, y_pos + 30, "ou non supportée")
                        c.setFillColor(colors.black)
                        c.setFont("Helvetica", 10)
                        
        # Commentaire
        if inspection.comments:
            c.drawString(45, 280, remove_emojis(inspection.comments[:1000]))
            
        # Signatures
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(40, 100, f"Technicien: {name}")

    c.save()
    overlay_buffer.seek(0)
    
    # 7. Fusion avec le template
    template_name = "report_template_2.pdf" if is_vehicule else "controle_template.pdf"
    template_path = os.path.join(settings.BASE_DIR, "templates", "pdf", template_name)
    
    if not os.path.exists(template_path):
        # En cas d'absence du template, retourne le document seul
        overlay_buffer.seek(0)
        return overlay_buffer

    reader = PdfReader(template_path)
    writer = PdfWriter()
    
    # 1. Page du template
    page = reader.pages[0]
    
    # 2. Fusion avec le document
    overlay_reader = PdfReader(overlay_buffer)
    overlay_page = overlay_reader.pages[0]
    page.merge_page(overlay_page)
    
    writer.add_page(page)
    
    final_buffer = BytesIO()
    writer.write(final_buffer)
    final_buffer.seek(0)
    
    return final_buffer
