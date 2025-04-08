import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support.expected_conditions import presence_of_element_located, element_to_be_clickable, visibility_of
from selenium.webdriver.support.expected_conditions import visibility_of_element_located
from selenium.webdriver.firefox.options import Options
from selenium.common.exceptions import NoSuchElementException, ElementNotInteractableException, NoAlertPresentException
from selenium.webdriver.support import expected_conditions as EC
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
import re
import time
from selenium.webdriver.firefox.firefox_profile import FirefoxProfile
from fake_useragent import UserAgent
import datetime

import os
import shutil
import tempfile
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from fake_useragent import UserAgent

def make_driver(make_headless=False):
    # Create the Firefox options
    user_agent = UserAgent().random
    print(f"Using User-Agent: {user_agent}")

    options = Options()
    options.set_preference("general.useragent.override", user_agent)
    options.set_preference("xpinstall.signatures.required", False)
    options.set_preference("extensions.autoDisableScopes", 0)
    options.set_preference("extensions.enabledScopes", 15)
    options.set_preference("extensions.install.requireBuiltInCerts", False)

    if make_headless:
        options.add_argument('--headless')
        options.add_argument("--window-size=1920x1080")
    else:
        options.add_argument("--window-size=1280x1024")

    driver = webdriver.Firefox(options=options)
    return driver



def obtain_element(driver, locator_tuple, timeout=10):
    # Note that you must check for the presence of an element **before** checking for their visibility
    # Otherwise you will get an "unable to locate element"

    # Check for the element
    by, value = locator_tuple
    WebDriverWait(driver, timeout).until(presence_of_element_located(locator_tuple))
    WebDriverWait(driver, timeout).until(visibility_of_element_located(locator_tuple))
    element = driver.find_element(by, value)
    return element

    
def register_and_login(driver):
    try:
        registration_url = "http://localhost:3000/register"
        timeout = 40
        # Go to the registration page
        driver.get(registration_url)

        # Using the time to make sure the input data is unique every time.
        suffix = datetime.datetime.now().strftime("%y%m%d_%H%M%S")
        full_name = "_".join(["Bob_Robinson", suffix])
        email = "_".join([full_name, "@gmail.com"])
        password = f"{full_name}_password"

        # Enter the full name.
        driver.find_element(By.ID, "name").send_keys(full_name)

        # Enter the email.
        driver.find_element(By.ID, "email").send_keys(email)

        # Enter the password.
        driver.find_element(By.ID, "password").send_keys(password)
        driver.find_element(By.ID, "confirmPassword").send_keys(password)

        # Wait until the Register button is visible. Once it's visible, store it then click it.
        register_button = obtain_element(driver, (By.XPATH, "//button[text()='Register']"), timeout)
        register_button.click()

        # Wait until alert is visible then accept it.
        WebDriverWait(driver, 5).until(EC.alert_is_present())
        driver.switch_to.alert.accept()

        # Should now be at the login page. Enter the details registered with and login.
        
        # Check for presence of Login title of page
        obtain_element(driver, (By.XPATH, "//h1[text()='Login']"), timeout)

        # Check for presence of email entry box, then fill in entry fields.
        LoginEmailElement = obtain_element(driver, (By.ID, "email"), timeout)
        LoginEmailElement.send_keys(email)
        driver.find_element(By.ID, "password").send_keys(password)

        # Check for presence of login button then click it
        login_button = obtain_element(driver, (By.XPATH, "//button[text()='Login']"), timeout )
        login_button.click()

        # Check we've been pushed to the landing page by checking if the header text loaded
        obtain_element(driver, (By.XPATH, "//h1[text()='Timed Release Crypto System']"), timeout)

        landing_url = "http://localhost:3000/"
        current_url = driver.current_url  

        if current_url == landing_url:
            return "success"
        else:
            return "fail"

    except NoSuchElementException as e:
        print("NoSuchElementException:\n%s" %(e))
        return "fail"
    
    except ElementNotInteractableException as e:
        print("ElementNotInteractableException:\n%s" %(e))
        return "fail"

    except AttributeError as e:
        print("AttributeError:\n%s" %(e))
        return "fail"

    except NoAlertPresentException as e:
        print("NoAlertPresentException:\n%s" %(e))
        return "fail"


if __name__ == '__main__':
    
    driver = make_driver(make_headless=False)
    auth_outcome = register_and_login(driver)
    if auth_outcome == "success":
        print("PASSED: AUTHENTICATION TEST")
    else:
        print("FAILED: AUTHENTICATION TEST")
    driver.quit()
    
