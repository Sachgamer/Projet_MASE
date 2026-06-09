# Generated migration for BlockedMacAddress model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_user_two_factor_code_user_two_factor_code_expires_at'),
    ]

    operations = [
        migrations.CreateModel(
            name='BlockedMacAddress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mac_address', models.CharField(db_index=True, max_length=17, unique=True)),
                ('blocked_at', models.DateTimeField(auto_now_add=True)),
                ('reason', models.CharField(default='Trop de tentatives 2FA infructueuses', max_length=255)),
                ('failed_attempts', models.IntegerField(default=5)),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'MAC Adresse Bloquée',
                'verbose_name_plural': 'MACs Adresses Bloquées',
                'ordering': ['-blocked_at'],
            },
        ),
    ]
