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

def generate_quiz_pdf(user_name, date_str, causerie_title, score, total_questions, is_passed, qa_pairs):
    # 1. Préparation calque
    overlay_buffer = BytesIO()
    c = canvas.Canvas(overlay_buffer, pagesize=A4)
    
    # Police
    c.setFont("Helvetica", 10)
    
    # 2. Remplissage des informations du haut
    # Nom de la personne interrogée
    c.drawString(175, 648, remove_emojis(user_name))
    
    # Date du contrôle
    c.drawString(115, 615, remove_emojis(date_str))
    
    # Thèmes de la causerie
    c.drawString(145, 583, remove_emojis(causerie_title))
    
    # Réussi ou non
    result_text = f"{'Oui' if is_passed else 'Non'} (Score : {score}/{total_questions})"
    c.setFillColor(colors.HexColor('#008000') if is_passed else colors.HexColor('#FF0000'))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(115, 552, result_text)
    
    # 3. Remplissage des questions et réponses dans l'espace vide (y de ~495 à ~150)
    y_pos = 495
    for idx, qa in enumerate(qa_pairs):
        q_text = qa['question_text']
        a_text = qa['answer_text']
        is_correct = qa['is_correct']
        
        # Envelopper le texte de la question pour éviter les débordements
        q_lines = wrap_text(f"Q{idx+1}. {q_text}", max_chars=90)
        
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.black)
        for line in q_lines:
            c.drawString(35, y_pos, remove_emojis(line))
            y_pos -= 11
            
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.black)
        c.drawString(50, y_pos, "Réponse apportée : ")
        
        # Colorer la réponse apportée (vert si correct, rouge si incorrect)
        if is_correct:
            c.setFillColor(colors.HexColor('#008000')) # vert foncé
        else:
            c.setFillColor(colors.HexColor('#FF0000')) # rouge
            
        # Envelopper le texte du choix si nécessaire
        a_lines = wrap_text(a_text, max_chars=80)
        c.drawString(135, y_pos, remove_emojis(a_lines[0]))
        y_pos -= 11
        for line in a_lines[1:]:
            c.drawString(135, y_pos, remove_emojis(line))
            y_pos -= 11
            
        y_pos -= 5 # Espacement supplémentaire entre les questions
        
    c.save()
    overlay_buffer.seek(0)
    
    # 4. Fusion avec le template
    template_path = os.path.join(settings.BASE_DIR, "templates", "pdf", "quiz_template.pdf")
    
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

def send_invitation_email(user, slideshow):
    try:
        from django.core.mail import send_mail
        from django.conf import settings
        
        user_name = f"{user.first_name} {user.last_name}".strip() or user.username
        theme = slideshow.title
        creator = slideshow.creator
        creator_name = f"{creator.first_name} {creator.last_name}".strip() or creator.username
        
        if slideshow.scheduled_date:
            # Affichage avec fuseau horaire si configuré
            from django.utils import timezone
            local_date = timezone.template_localtime(slideshow.scheduled_date)
            date_str = local_date.strftime("%d/%m/%Y à %H:%M")
        else:
            date_str = "dès que possible"
            
        subject = f"[WebMASE] Invitation à la causerie : {theme}"
        
        message = (
            f"Bonjour {user_name},\n\n"
            f"Vous êtes invité à participer à la causerie sécurité suivante : {theme}.\n"
            f"Votre présence est indiquée comme OBLIGATOIRE.\n\n"
            f"Détails de la causerie :\n"
            f"- Thème : {theme}\n"
            f"- Description : {slideshow.description}\n"
            f"- Date de présence obligatoire : {date_str}\n\n"
            f"Veuillez vous connecter sur la plateforme WebMASE pour consulter la présentation et répondre au quiz associé.\n\n"
            f"Cordialement,\n"
            f"{creator_name}"
        )
        
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@webmase.com')
            
        if user.email:
            send_mail(
                subject,
                message,
                from_email,
                [user.email],
                fail_silently=False,
            )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erreur lors de la préparation ou de l'envoi de l'email d'invitation : {e}")
