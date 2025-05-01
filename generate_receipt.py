#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import datetime
from fpdf2 import FPDF

# Constants
PIXTER_FEE_PERCENTAGE = 0.03
COMPANY_NAME = "Pixter"

class PDFReceipt(FPDF):
    def header(self):
        # Logo - Placeholder for now, can add image later if needed
        self.set_font("Helvetica", "B", 18)
        self.cell(0, 10, COMPANY_NAME, 0, 1, "C")
        self.ln(5) # Line break

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Página {self.page_no()}", 0, 0, "C")
        self.set_x(-50) # Position for timestamp
        self.cell(0, 10, f"Gerado em: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", 0, 0, "R")

    def add_title(self, title):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, title, 0, 1, "C")
        self.ln(10)

    def add_line_item(self, label, value):
        self.set_font("Helvetica", "", 11)
        self.cell(50, 8, f"{label}:", 0, 0, "L")
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 8, str(value), 0, 1, "L")

    def add_separator(self):
        self.ln(5)
        self.set_draw_color(200, 200, 200) # Light gray
        self.cell(0, 0, "", "T", 1, "C")
        self.ln(5)

    def add_total(self, label, value):
        self.ln(5)
        self.set_font("Helvetica", "B", 12)
        self.cell(0, 10, f"{label}: {value}", 0, 1, "R")

def format_currency(value):
    """Formats a float value into BRL currency string."""
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def generate_client_receipt(filename, payment_details):
    """Generates a PDF receipt for the client."""
    pdf = PDFReceipt()
    pdf.add_page()
    pdf.add_title("Comprovante de Pagamento")

    pdf.add_line_item("ID da Transação", payment_details.get("transaction_id", "N/A"))
    pdf.add_line_item("Data", payment_details.get("date", "N/A"))
    pdf.add_line_item("Recebido por", payment_details.get("driver_name", "N/A"))
    pdf.add_line_item("Método", payment_details.get("method", "N/A"))
    
    pdf.add_separator()
    
    total_paid = payment_details.get("amount_paid", 0.0)
    pdf.add_total("Valor Total Pago", format_currency(total_paid))

    pdf.output(filename)
    print(f"Client receipt generated: {filename}")

def generate_driver_receipt(filename, payment_details):
    """Generates a PDF receipt for the driver, including fees."""
    pdf = PDFReceipt()
    pdf.add_page()
    pdf.add_title("Detalhes do Recebimento")

    pdf.add_line_item("ID da Transação", payment_details.get("transaction_id", "N/A"))
    pdf.add_line_item("Data", payment_details.get("date", "N/A"))
    pdf.add_line_item("Cliente", payment_details.get("client_identifier", "N/A")) # e.g., email or name if available
    pdf.add_line_item("Método", payment_details.get("method", "N/A"))

    pdf.add_separator()

    original_amount = payment_details.get("amount_original", 0.0)
    pixter_fee = original_amount * PIXTER_FEE_PERCENTAGE
    net_amount = original_amount - pixter_fee

    pdf.add_line_item("Valor Bruto Recebido", format_currency(original_amount))
    pdf.add_line_item(f"Taxa Pixter ({PIXTER_FEE_PERCENTAGE*100:.0f}%)", f"- {format_currency(pixter_fee)}")
    
    pdf.add_separator()
    
    pdf.add_total("Valor Líquido Recebido", format_currency(net_amount))

    pdf.output(filename)
    print(f"Driver receipt generated: {filename}")

# Example Usage (for testing)
if __name__ == "__main__":
    test_payment = {
        "transaction_id": "ch_3P9xQzLkdIwHu7ix1aBcDefG",
        "date": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
        "driver_name": "João Silva",
        "client_identifier": "maria@example.com",
        "method": "Cartão Visa final 4242",
        "amount_paid": 50.00, # Amount client paid
        "amount_original": 50.00 # Amount before fees for driver
    }
    
    generate_client_receipt("/home/ubuntu/pixter/client_receipt_example.pdf", test_payment)
    generate_driver_receipt("/home/ubuntu/pixter/driver_receipt_example.pdf", test_payment)

