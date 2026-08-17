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
        # Remplissage des informations du haut (sur la ligne unique y=626.0)
        c.drawString(70, 626.0, name)
        c.drawString(262, 626.0, date_str)
        
        exp_date = inspection.item.expiration_date
        exp_date_str = exp_date.strftime("%d/%m/%Y") if exp_date else "N/A"
        c.drawString(470, 626.0, exp_date_str)
        
        # Détails du matériel à y=598.9
        c.drawString(120, 598.9, remove_emojis(inspection.item.get_category_display()))
        
        designation_sn = f"{inspection.item.type_name} (S/N: {inspection.item.serial_number or 'N/A'})"
        c.drawString(258, 598.9, remove_emojis(designation_sn))
        
        # Contrôle status
        c.setFont("Helvetica-Bold", 10)
        if inspection.is_valid:
            c.setFillColor(colors.green)
            c.drawString(458, 598.9, "CONFORME")
        else:
            c.setFillColor(colors.red)
            c.drawString(458, 598.9, "NON CONFORME")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        
        # Check technique du véhicule (lignes y=555.6 et y=529.1)
        if inspection.vehicle_checks:
            checks_positions = [
                ('Feux (Avant/Arrière/Signalisation)', 147, 555.6),
                ('Carrosserie', 258, 555.6),
                ('Propreté (Intérieur/Extérieur)', 368, 555.6),
                ('Freins', 470, 555.6),
                ('Documents techniques présents', 127, 529.1),
                ('État des pneus', 260, 529.1),
                ('Niveaux (Huile/Liquide de refroidissement)', 488, 529.1)
            ]
            c.setFont("Helvetica-Bold", 9)
            for db_key, x_pos, y_pos in checks_positions:
                val = inspection.vehicle_checks.get(db_key)
                if val is True:
                    c.setFillColor(colors.green)
                    c.drawString(x_pos, y_pos, "Valide")
                elif val is False:
                    c.setFillColor(colors.red)
                    c.drawString(x_pos, y_pos, "Non Valide")
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 10)
            
        # Commentaire de l'inspection (dans le cadre "Description de l'incident" y=374.5 à y=475.6)
        comments_text = inspection.comments or ""
        if comments_text:
            c.setFont("Helvetica", 9)
            comment_lines = wrap_text(comments_text, max_chars=95)
            y_comm = 460
            for line in comment_lines[:8]:  # Limiter à 8 lignes pour rester dans le cadre
                c.drawString(45, y_comm, remove_emojis(line))
                y_comm -= 12
            c.setFont("Helvetica", 10)
            
        # Photos dans la zone dédiée (y=165.7 à y=335.4, hauteur 169.7)
        photos = inspection.photos.all()
        if photos.exists():
            for idx, photo_obj in enumerate(photos[:3]):
                img_path = photo_obj.image.path
                if os.path.exists(img_path):
                    x_pos = 45 + (idx * 175)
                    y_pos = 180
                    try:
                        c.drawImage(img_path, x_pos, y_pos, width=160, height=135, preserveAspectRatio=True)
                    except Exception:
                        c.setStrokeColor(colors.red)
                        c.rect(x_pos, y_pos, 160, 135, stroke=1, fill=0)
                        c.setFont("Helvetica-Bold", 8)
                        c.setFillColor(colors.red)
                        c.drawCentredString(x_pos + 80, y_pos + 70, "Image corrompue")
                        c.drawCentredString(x_pos + 80, y_pos + 55, "ou non supportée")
                        c.setFillColor(colors.black)
                        c.setFont("Helvetica", 10)
            
        # Signatures (dans le cadre de signature gauche y=112.5 à y=155.2)
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(45, 127, f"Signé par : {name}")
    else:
        # EPI ou EQUIPEMENT (controle_template.pdf)
        # Remplissage des informations du haut (sur la ligne unique y=626.0)
        c.drawString(70, 626.0, name)
        c.drawString(262, 626.0, date_str)
        
        exp_date = inspection.item.expiration_date
        exp_date_str = exp_date.strftime("%d/%m/%Y") if exp_date else "N/A"
        c.drawString(470, 626.0, exp_date_str)
        
        # Détails du matériel à y=598.9
        c.drawString(120, 598.9, remove_emojis(inspection.item.get_category_display()))
        
        designation_sn = f"{inspection.item.type_name} (S/N: {inspection.item.serial_number or 'N/A'})"
        c.drawString(275, 598.9, remove_emojis(designation_sn))
        
        # Contrôle status
        c.setFont("Helvetica-Bold", 10)
        if inspection.is_valid:
            c.setFillColor(colors.green)
            c.drawString(441, 598.9, "CONFORME")
        else:
            c.setFillColor(colors.red)
            c.drawString(441, 598.9, "NON CONFORME")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        
        # Checklist de défauts (y=553.7)
        if inspection.item.category == 'EQUIPEMENT':
            # Masquer la ligne par défaut
            c.setFillColor(colors.white)
            c.rect(35, 546, 420, 14, fill=True, stroke=False)
            c.setFillColor(colors.black)
            
            # Dessiner les nouveaux labels d'équipement
            c.drawString(42.2, 553.7, "Dysfonctionnement :")
            c.drawString(210, 553.7, "HS :")
            c.drawString(310, 553.7, "Altéré :")
            
            defects_positions = [
                ('Dysfonctionnement', 140),
                ('HS', 240),
                ('Altéré', 355)
            ]
        else:
            # EPI
            defects_positions = [
                ('Trou', 70),
                ('Déchirure', 200),
                ('Cassé', 320),
                ('Autres', 434)
            ]
            
        # Dessiner le statut de chaque défaut ("Oui" en rouge si défaut, "Non" en vert si conforme)
        c.setFont("Helvetica-Bold", 9)
        for defect_name, x_pos in defects_positions:
            is_defective = inspection.defects.get(defect_name, False)
            if is_defective:
                c.setFillColor(colors.red)
                c.drawString(x_pos, 553.7, "Oui")
            else:
                c.setFillColor(colors.green)
                c.drawString(x_pos, 553.7, "Non")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
            
        # Avertissement d'absence de l'EPI
        if inspection.item.category == 'EPI' and inspection.defects.get('Absent', False):
            c.setFillColor(colors.red)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(42.2, 525, "ATTENTION : Équipement signalé comme ABSENT")
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 10)
            
        # Commentaire de l'inspection (dans le cadre "Description de l'incident" y=401.0 à y=502.1)
        comments_text = inspection.comments or ""
        if comments_text:
            c.setFont("Helvetica", 9)
            comment_lines = wrap_text(comments_text, max_chars=95)
            y_comm = 487
            for line in comment_lines[:8]:  # Limiter à 8 lignes pour rester dans le cadre
                c.drawString(45, y_comm, remove_emojis(line))
                y_comm -= 12
            c.setFont("Helvetica", 10)
            
        # Photos dans la zone dédiée (y=175.1 à y=361.9, hauteur 186.7)
        photos = inspection.photos.all()
        if photos.exists():
            for idx, photo_obj in enumerate(photos[:3]):
                img_path = photo_obj.image.path
                if os.path.exists(img_path):
                    x_pos = 45 + (idx * 175)
                    y_pos = 195
                    try:
                        c.drawImage(img_path, x_pos, y_pos, width=160, height=150, preserveAspectRatio=True)
                    except Exception:
                        c.setStrokeColor(colors.red)
                        c.rect(x_pos, y_pos, 160, 150, stroke=1, fill=0)
                        c.setFont("Helvetica-Bold", 8)
                        c.setFillColor(colors.red)
                        c.drawCentredString(x_pos + 80, y_pos + 80, "Image corrompue")
                        c.drawCentredString(x_pos + 80, y_pos + 65, "ou non supportée")
                        c.setFillColor(colors.black)
                        c.setFont("Helvetica", 10)
            
        # Signatures (dans le cadre de signature gauche y=118.4 à y=160.7)
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(45, 130, f"Signé par : {name}")

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
