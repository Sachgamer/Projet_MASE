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
    c.drawString(150, 667, name) # Lowered by 3 from 670 to 667
    
    # Date of inspection
    date_str = inspection.date.strftime("%d/%m/%Y %H:%M")
    c.drawString(100, 635, date_str) # Moved 5 right from 95 to 100
    
    # Next inspection date
    try:
        next_date = inspection.next_date.strftime("%d/%m/%Y")
    except AttributeError:
        next_date = "N/A"
    c.drawString(75, 567, next_date) # Moved 15 left from 90 to 75
    
    # 3. Fill Table
    y_table = 510 # Calibrated row y
    c.drawString(220, y_table, inspection.item.type_name) # Type (x=220)
    c.drawString(105, y_table, inspection.item.serial_number or "N/A") # S/N or Plaque (Moved 5 right from 100 to 105)
    c.drawString(45, y_table, inspection.item.get_category_display()) # Désignation ("Véhicule") - Moved 5 right from 40 to 45
    
    # Contrôle (Moved 5 right from 480 to 485, font size 8)
    c.setFont("Helvetica", 8)
    c.drawString(485, y_table, "CONFORME" if inspection.is_valid else "NON CONFORME")
    c.setFont("Helvetica", 10) # Restore font size
    
    # 4. Commentaire
    if inspection.comments:
        c.drawString(50, 450, inspection.comments[:1000]) # (x=50, y=450)
        
    # 5. Signatures (Placeholder text if no images)
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(80, 140, f"Technicien: {inspection.item.technician.username}")
    
    # 6. Photos (Overlay)
    if inspection.photo:
        img_path = inspection.photo.path
        if os.path.exists(img_path):
            # Place photo at (400, 350) as requested
            c.drawImage(img_path, 400, 350, width=150, height=100, preserveAspectRatio=True)

    c.save()
    overlay_buffer.seek(0)
    
    # 7. Merge with Template
    template_path = os.path.join(settings.BASE_DIR, "templates", "pdf", "report_template.pdf")
    
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
