package demo;

import demo.UserController;

public class Application {
    public static void main(String[] args) {
        System.out.println(new UserController().list());
    }
}
