import matplotlib.pyplot as plt

class Plotter:

    def plot(self, chart_type, df, x, y):
        if chart_type == "bar":
            plt.bar(df[x], df[y])
        elif chart_type == "scatter":
            plt.scatter(df[x], df[y])
        else:
            plt.plot(df[x], df[y])

        plt.xlabel(x)
        plt.ylabel(y)
        plt.show()
