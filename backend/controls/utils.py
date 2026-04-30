import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from django.conf import settings

def generate_inspection_pdf(inspection):
    # 1. Prepare the overlay with reportlab
    overlay_buffer = BytesIO()
    c = canvas.Canvas(overlay_buffer, pagesize=A4)
    
    # helper for coordinates
    # A4 is approx 595 x 842 points
    
    # Set font
    c.setFont("Helvetica", 10)
    
    # 2. Fill top info
    # Name (Technician)
    name = f"{inspection.item.technician.first_name} {inspection.item.technician.last_name}"
    c.drawString(180, 667, name) 
    
    # Date of inspection
    date_str = inspection.date.strftime("%d/%m/%Y %H:%M")
    c.drawString(130, 647, date_str) 
    
    # Technical checks (Vehicle)
    if inspection.item.category == 'VEHICULE' and inspection.vehicle_checks:
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
    elif inspection.item.category != 'VEHICULE' and inspection.defects:
        y_pos = 606
        for defect, is_present in inspection.defects.items():
            if is_present:
                c.setFillColor(colors.red)
                c.drawString(250, y_pos, f"Défaut: {defect}")
                y_pos -= 15
        c.setFillColor(colors.black)
    
    # 3. Fill Table
    y_table = 455 
    c.drawCentredString(67, y_table, inspection.item.get_category_display()) # Type
    c.drawCentredString(130, y_table, inspection.item.serial_number or "N/A") # S/N
    c.drawCentredString(321, y_table, inspection.item.type_name) # Désignation
    
    # Contrôle
    c.setFont("Helvetica", 8)
    c.drawCentredString(520, y_table, "CONFORME" if inspection.is_valid else "NON CONFORME")
    c.setFont("Helvetica", 10) 
    
    # 4. Photos (Overlay)
    photos = inspection.photos.all()
    if photos.exists():
        for idx, photo_obj in enumerate(photos[:3]): 
            img_path = photo_obj.image.path
            if os.path.exists(img_path):
                x_pos = 40 + (idx * 160)
                y_pos = 280
                c.drawImage(img_path, x_pos, y_pos, width=150, height=100, preserveAspectRatio=True)

    # 5. Commentaire
    if inspection.comments:
        c.drawString(45, 220, inspection.comments[:1000]) 
        
    # 6. Signatures 
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(40, 100, f"Technicien: {name}")

    c.save()
    overlay_buffer.seek(0)
    
    # 7. Merge with Template
    template_path = os.path.join(settings.BASE_DIR, "templates", "pdf", "report_template_2.pdf")
    
    if not os.path.exists(template_path):
        # Fallback to old generation or error if template missing
        # For now, let's just use the overlay alone if template missing (will be white background)
        overlay_buffer.seek(0)
        return overlay_buffer

    reader = PdfReader(template_path)
    writer = PdfWriter()
    
    # Get the first page of the template
    page = reader.pages[0]
    
    # Merge with the overlay
    overlay_reader = PdfReader(overlay_buffer)
    overlay_page = overlay_reader.pages[0]
    page.merge_page(overlay_page)
    
    writer.add_page(page)
    
    final_buffer = BytesIO()
    writer.write(final_buffer)
    final_buffer.seek(0)
    
    return final_buffer
