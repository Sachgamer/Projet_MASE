from django.contrib import admin
from .models import AccidentReport, WorkSite

admin.site.register(AccidentReport)

@admin.register(WorkSite)
class WorkSiteAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'latitude', 'longitude', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'address')
