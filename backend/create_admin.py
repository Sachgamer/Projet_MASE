import os
import django 

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()
username = 'SDE'
password = 'Sachgamerrap93!'
# MODIFIEZ CE MAIL : Vrai mail obligatoire pour ne pas faire planter l'envoi au login !
email = 's.degroote@goron-systemes.fr'

try:
    user = User.objects.get(username=username)
    user.set_password(password)
    user.email = email
    user.save()
    print(f"Updated password and email for user '{username}'")
except User.DoesNotExist:
    User.objects.create_superuser(username, email, password)
    print(f"Created superuser '{username}'")
